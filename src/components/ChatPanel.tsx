import { useEffect, useRef, useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, Bot, FileSearch, RotateCcw, Square } from 'lucide-react'
import { streamChat } from '../lib/api'
import type { ChatMessage, DocumentRow, Source } from '../types'

const SUGGESTIONS = [
  'Summarize this document in 5 bullet points',
  'What are the key terms and their definitions?',
  'What are the main conclusions?',
]

export function ChatPanel({ doc }: { doc: DocumentRow }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  // Stop any in-flight answer when leaving the page
  useEffect(() => () => abortRef.current?.abort(), [])

  function patchLast(update: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => [...prev.slice(0, -1), update(prev[prev.length - 1])])
  }

  async function ask(question: string) {
    const q = question.trim()
    if (!q || streaming) return
    setInput('')

    const history = messages
    setMessages([...history, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(
        doc.id,
        q,
        history,
        {
          onSources: (sources: Source[]) => patchLast((m) => ({ ...m, sources })),
          onToken: (t: string) => patchLast((m) => ({ ...m, content: m.content + t })),
        },
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        patchLast((m) => ({ ...m, error: true, content: m.content || (err as Error).message }))
      }
    } finally {
      setStreaming(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="card flex h-[calc(100vh-13rem)] min-h-[480px] flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <EmptyState docName={doc.name} onPick={ask} />
        ) : (
          messages.map((m, i) => (
            <Message key={i} message={m} typing={streaming && i === messages.length - 1} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-white/10 bg-ink-950/40 p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink-900 p-2 focus-within:border-brand-500/70">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(input)
              }
            }}
            rows={1}
            placeholder="Ask a question about this PDF…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {messages.length > 0 && !streaming && (
            <button type="button" onClick={() => setMessages([])} className="btn-ghost h-9 w-9 p-0" title="New chat">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {streaming ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn-ghost h-9 w-9 p-0" title="Stop">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="btn-primary h-9 w-9 p-0" title="Send">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">Answers come only from your PDF and cite their pages.</p>
      </form>
    </div>
  )
}

function Message({ message, typing }: { message: ChatMessage; typing: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2.5 text-sm text-white shadow-lg shadow-brand-600/20">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-accent-400/20 ring-1 ring-white/10">
        <Bot className="h-4 w-4 text-brand-300" />
      </div>
      <div className="min-w-0 max-w-[85%]">
        <div
          className={`rounded-2xl rounded-tl-sm border px-4 py-3 ${
            message.error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.04]'
          }`}
        >
          {message.content ? (
            <div className="markdown">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <TypingDots />
          )}
          {typing && message.content && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-blink bg-brand-400" />}
        </div>
        {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}
      </div>
    </div>
  )
}

function Sources({ sources }: { sources: Source[] }) {
  // one chip per page, best match first
  const byPage = new Map<number, Source>()
  for (const s of sources) if (!byPage.has(s.page)) byPage.set(s.page, s)

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[...byPage.values()].map((s) => (
        <span
          key={s.page}
          title={s.snippet}
          className="cursor-help rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11px] text-slate-400 transition hover:border-brand-500/50 hover:text-brand-300"
        >
          p. {s.page}
        </span>
      ))}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1.5">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  )
}

function EmptyState({ docName, onPick }: { docName: string; onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-accent-400/20 ring-1 ring-white/10">
        <FileSearch className="h-7 w-7 text-brand-300" />
      </div>
      <h3 className="text-lg font-semibold text-white">Chat with “{docName}”</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">Ask anything. Answers are grounded in the document and cite the pages they come from.</p>
      <div className="mt-6 flex w-full max-w-md flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)} className="btn-ghost justify-start text-left font-normal text-slate-300">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
