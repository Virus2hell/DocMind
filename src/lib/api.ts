// Everything that talks to Supabase (database + Edge Functions) lives here.
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
import { extractPdfText } from './pdf'
import { chunkPages, countWords, type Chunk } from './chunk'
import type { ChatMessage, DocumentRow, QASet, Source } from '../types'

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function listDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as DocumentRow[]
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as DocumentRow | null
}

export async function deleteDocument(id: string): Promise<void> {
  // chunks + qa_sets are removed automatically (ON DELETE CASCADE)
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

export type UploadStage = 'reading' | 'chunking' | 'embedding' | 'done'
export interface UploadProgress {
  stage: UploadStage
  done: number
  total: number
}

const BATCH_SIZE = 16
const CONCURRENCY = 3

/**
 * Full ingestion pipeline:
 *   PDF → text per page (browser) → chunks (browser, LangChain splitter)
 *   → create `documents` row → send chunk batches to the `ingest` function
 *     (which embeds them with gte-small and stores them in pgvector)
 */
export async function uploadDocument(file: File, onProgress: (p: UploadProgress) => void): Promise<DocumentRow> {
  onProgress({ stage: 'reading', done: 0, total: 1 })
  const pages = await extractPdfText(file, (done, total) => onProgress({ stage: 'reading', done, total }))

  onProgress({ stage: 'chunking', done: 0, total: 1 })
  const chunks = await chunkPages(pages)

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      name: file.name.replace(/\.pdf$/i, ''),
      page_count: pages.length,
      word_count: countWords(pages),
      chunk_count: chunks.length,
    })
    .select()
    .single()
  if (error) throw error

  try {
    const batches: Chunk[][] = []
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) batches.push(chunks.slice(i, i + BATCH_SIZE))

    let done = 0
    onProgress({ stage: 'embedding', done, total: chunks.length })

    // Simple worker pool: CONCURRENCY batches in flight at a time.
    let next = 0
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next++]
        await withRetry(() => invokeFunction('ingest', { document_id: doc.id, chunks: batch }))
        done += batch.length
        onProgress({ stage: 'embedding', done, total: chunks.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))

    const { data: ready, error: updErr } = await supabase
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', doc.id)
      .select()
      .single()
    if (updErr) throw updErr

    onProgress({ stage: 'done', done: chunks.length, total: chunks.length })
    return ready as DocumentRow
  } catch (err) {
    await supabase.from('documents').update({ status: 'failed' }).eq('id', doc.id)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Chat (streaming)
// ---------------------------------------------------------------------------

export interface ChatHandlers {
  onSources: (sources: Source[]) => void
  onToken: (token: string) => void
}

/** Calls the `chat` function and reads its NDJSON stream line by line. */
export async function streamChat(
  documentId: string,
  question: string,
  history: ChatMessage[],
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      document_id: documentId,
      question,
      history: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
    }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(await readError(res))

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      const event = JSON.parse(line)
      if (event.type === 'sources') handlers.onSources(event.sources)
      else if (event.type === 'token') handlers.onToken(event.value)
      else if (event.type === 'error') throw new Error(friendlyError(event.message))
    }
  }
}

// ---------------------------------------------------------------------------
// Q&A sets
// ---------------------------------------------------------------------------

export async function listQASets(documentId: string): Promise<QASet[]> {
  const { data, error } = await supabase
    .from('qa_sets')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as QASet[]
}

export async function saveQASet(set: Omit<QASet, 'id' | 'created_at'>): Promise<QASet> {
  const { data, error } = await supabase.from('qa_sets').insert(set).select().single()
  if (error) throw error
  return data as QASet
}

export async function deleteQASet(id: string): Promise<void> {
  const { error } = await supabase.from('qa_sets').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You are signed out. Please sign in again.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

/** POST to an Edge Function and return its JSON. */
export async function invokeFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = new Error(await readError(res)) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return friendlyError(body.error ?? body.message ?? res.statusText)
  } catch {
    return `Request failed (${res.status})`
  }
}

export function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|rate.?limit|too many requests/i.test(msg) || (err as { status?: number })?.status === 429
}

function friendlyError(message: string): string {
  if (/429|rate.?limit/i.test(message)) return 'Groq free-tier rate limit reached. Wait a minute and try again.'
  if (/model.*(decommissioned|not found|does not exist)/i.test(message))
    return 'The configured Groq model is unavailable. Set GROQ_MODEL to a current model (see README).'
  return message
}

/** Retries a request when it fails; waits longer after each attempt. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 2000, onWait }: { attempts?: number; baseDelayMs?: number; onWait?: (ms: number) => void } = {},
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = (err as { status?: number }).status
      if (status && status >= 400 && status < 500 && status !== 429) throw err // bad request: don't retry
      if (i < attempts - 1) {
        const wait = isRateLimit(err) ? 20000 * (i + 1) : baseDelayMs * 2 ** i
        onWait?.(wait)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
}
