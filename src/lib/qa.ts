// Q&A generation = MAP-REDUCE, orchestrated from the browser.
//
//   PLAN    split the document's chunks into sections (windows of chunk indexes)
//   MAP     call the `generate-qa` function once per section
//   REDUCE  merge → remove near-duplicates → balance across sections → trim to N
//
// If the document can't support N good questions, the model returns fewer and we
// simply report how many we got ("Only 12 questions could be generated").
import { invokeFunction, withRetry } from './api'
import type { Difficulty, DocumentRow, QAItem, QuestionType } from '../types'

export const QUESTION_COUNTS = [10, 15, 20, 25, 30] as const

const MAX_CHUNKS_PER_SECTION = 10 // ≈10k characters per LLM call
const QUESTIONS_PER_CALL = 8
const MAX_CALLS = 8
const OVERSAMPLE = 1.3 // ask for ~30% extra because duplicates get removed

export interface Section {
  from: number
  to: number
}

export function planSections(chunkCount: number, requested: number): Section[] {
  if (chunkCount === 0) return []
  const wanted = Math.ceil((requested * OVERSAMPLE) / QUESTIONS_PER_CALL)
  const neededForCoverage = Math.ceil(chunkCount / MAX_CHUNKS_PER_SECTION)
  const calls = Math.min(MAX_CALLS, chunkCount, Math.max(wanted, neededForCoverage))

  const sections: Section[] = []
  if (chunkCount <= calls * MAX_CHUNKS_PER_SECTION) {
    // Whole document fits: split it evenly.
    const size = Math.ceil(chunkCount / calls)
    for (let from = 0; from < chunkCount; from += size) {
      sections.push({ from, to: Math.min(from + size, chunkCount) - 1 })
    }
  } else {
    // Long document: take evenly spaced windows so every part is represented.
    const stride = chunkCount / calls
    for (let i = 0; i < calls; i++) {
      const from = Math.floor(i * stride)
      sections.push({ from, to: Math.min(from + MAX_CHUNKS_PER_SECTION, chunkCount) - 1 })
    }
  }
  return sections
}

/** Rough upper bound shown in the UI: ~1 good question per 120 words. */
export function estimateMaxQuestions(wordCount: number): number {
  return Math.max(3, Math.floor(wordCount / 120))
}

export interface QAProgress {
  section: number
  totalSections: number
  found: number
  waitingMs?: number
}

export interface QAResult {
  items: QAItem[]
  requested: number
  sectionsFailed: number
}

export async function generateQuestions(
  doc: DocumentRow,
  requested: number,
  questionType: QuestionType,
  difficulty: Difficulty,
  onProgress: (p: QAProgress) => void,
): Promise<QAResult> {
  const sections = planSections(doc.chunk_count, requested)
  const perSection = Math.min(15, Math.max(2, Math.ceil((requested * OVERSAMPLE) / sections.length)))

  const bySection: QAItem[][] = []
  let failed = 0
  let lastError: unknown

  // Sequential on purpose: Groq's free tier limits tokens per minute.
  for (let i = 0; i < sections.length; i++) {
    const found = bySection.flat().length
    onProgress({ section: i + 1, totalSections: sections.length, found })
    try {
      const { items } = await withRetry(
        () =>
          invokeFunction<{ items: QAItem[] }>('generate-qa', {
            document_id: doc.id,
            from_index: sections[i].from,
            to_index: sections[i].to,
            count: perSection,
            question_type: questionType,
            difficulty,
            avoid: bySection.flat().map((q) => q.question),
          }),
        { onWait: (ms) => onProgress({ section: i + 1, totalSections: sections.length, found, waitingMs: ms }) },
      )
      bySection.push(dedupe(items, bySection.flat()))
    } catch (err) {
      failed++
      lastError = err
      bySection.push([])
    }
  }

  if (failed === sections.length) throw lastError ?? new Error('Generation failed')

  // REDUCE: take questions round-robin from each section so the set covers the
  // whole document instead of just the first pages, then sort by page.
  const picked: QAItem[] = []
  for (let round = 0; picked.length < requested; round++) {
    let added = false
    for (const list of bySection) {
      if (round < list.length && picked.length < requested) {
        picked.push(list[round])
        added = true
      }
    }
    if (!added) break
  }
  picked.sort((a, b) => (a.page ?? 0) - (b.page ?? 0))

  return { items: picked, requested, sectionsFailed: failed }
}

// ---------------------------------------------------------------------------
// Near-duplicate detection (Jaccard similarity on meaningful words)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  'a an the is are was were be been of to in on for and or what which who whom why how does do did it its this that these those with as by from at according main'.split(' '),
)

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

export function dedupe(items: QAItem[], existing: QAItem[] = [], threshold = 0.6): QAItem[] {
  const seen = existing.map((q) => keywords(q.question))
  const out: QAItem[] = []
  for (const item of items) {
    const k = keywords(item.question)
    if (seen.some((s) => similarity(s, k) >= threshold)) continue
    seen.push(k)
    out.push(item)
  }
  return out
}
