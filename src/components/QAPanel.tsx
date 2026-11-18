import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Download, Eye, EyeOff, History, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { deleteQASet, listQASets, saveQASet } from '../lib/api'
import { estimateMaxQuestions, generateQuestions, QUESTION_COUNTS, type QAProgress } from '../lib/qa'
import { downloadQAPdf } from '../lib/exportPdf'
import type { Difficulty, DocumentRow, QASet, QuestionType } from '../types'
import { QAList } from './QAList'
import { Spinner } from './Spinner'

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'short', label: 'Short answer' },
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'mixed', label: 'Mixed' },
]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export function QAPanel({ doc }: { doc: DocumentRow }) {
  const [count, setCount] = useState<number>(10)
  const [qType, setQType] = useState<QuestionType>('short')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const [progress, setProgress] = useState<QAProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<QASet | null>(null)
  const [history, setHistory] = useState<QASet[]>([])
  const [hideAnswers, setHideAnswers] = useState(false)

  const estimate = estimateMaxQuestions(doc.word_count)

  useEffect(() => {
    listQASets(doc.id)
      .then((sets) => {
        setHistory(sets)
        setCurrent(sets[0] ?? null)
      })
      .catch(() => {})
  }, [doc.id])

  async function generate() {
    setError(null)
    setProgress({ section: 0, totalSections: 1, found: 0 })
    try {
      const result = await generateQuestions(doc, count, qType, difficulty, setProgress)
      if (result.items.length === 0) throw new Error('No questions could be generated from this document.')
      const saved = await saveQASet({
        document_id: doc.id,
        requested: count,
        generated: result.items.length,
        question_type: qType,
        difficulty,
        items: result.items,
      })
      setCurrent(saved)
      setHistory((h) => [saved, ...h])
      setHideAnswers(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setProgress(null)
    }
  }

  async function removeSet(id: string) {
    await deleteQASet(id)
    setHistory((h) => h.filter((s) => s.id !== id))
    if (current?.id === id) setCurrent(null)
  }

  const busy = progress !== null

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ---------- Settings ---------- */}
      <aside className="space-y-4">
        <div className="card space-y-5 p-5">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Wand2 className="h-4 w-4 text-brand-400" /> Generate questions
            </h3>
            <p className="mt-1 text-xs text-slate-400">Creates questions with answers from the whole document.</p>
          </div>

          <Field label="Number of questions">
            <div className="grid grid-cols-5 gap-1.5">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  disabled={busy}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    count === n ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {count > estimate && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300/90">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                This document is short (~{doc.word_count} words), so it may support fewer than {count} questions.
              </p>
            )}
          </Field>

          <Field label="Question type">
            <div className="grid grid-cols-2 gap-1.5">
              {TYPES.map((t) => (
                <Chip key={t.value} active={qType === t.value} onClick={() => setQType(t.value)} disabled={busy}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Difficulty">
            <div className="grid grid-cols-3 gap-1.5">
              {DIFFICULTIES.map((d) => (
                <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)} disabled={busy}>
                  <span className="capitalize">{d}</span>
                </Chip>
              ))}
            </div>
          </Field>

          <button onClick={generate} disabled={busy} className="btn-primary w-full py-3">
            {busy ? <Spinner className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Generating…' : `Generate ${count} questions`}
          </button>
        </div>

        {history.length > 0 && (
          <div className="card p-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <History className="h-3.5 w-3.5" /> Previous sets
            </h4>
            <ul className="space-y-1">
              {history.map((s) => (
                <li key={s.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => setCurrent(s)}
                    className={`flex-1 rounded-lg px-3 py-2 text-left text-xs transition ${
                      current?.id === s.id ? 'bg-brand-500/15 text-brand-200' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-medium">{plural(s.generated, 'question')}</span> · {TYPES.find((t) => t.value === s.question_type)?.label} ·{' '}
                    <span className="capitalize">{s.difficulty}</span>
                    <span className="block text-[10px] text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
                  </button>
                  <button
                    onClick={() => removeSet(s.id)}
                    className="rounded-lg p-1.5 text-slate-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    title="Delete set"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* ---------- Results ---------- */}
      <section className="min-w-0">
        {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        {busy ? (
          <ProgressCard progress={progress} />
        ) : current ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{plural(current.generated, 'question')}</h3>
                <p className="text-xs text-slate-400">
                  {TYPES.find((t) => t.value === current.question_type)?.label} · <span className="capitalize">{current.difficulty}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setHideAnswers((v) => !v)} className="btn-ghost">
                  {hideAnswers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {hideAnswers ? 'Show answers' : 'Study mode'}
                </button>
                <button onClick={() => downloadQAPdf(doc.name, current)} className="btn-primary">
                  <Download className="h-4 w-4" /> Download PDF
                </button>
              </div>
            </div>

            {current.generated < current.requested && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  You asked for {current.requested}, but only <b>{plural(current.generated, 'question')}</b> could be generated from this PDF. The
                  document doesn't contain enough distinct content for more without repeating or inventing facts.
                </p>
              </div>
            )}

            <QAList key={current.id} items={current.items} hideAnswers={hideAnswers} />
          </>
        ) : (
          <div className="card flex h-full min-h-[320px] flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-accent-400/20 ring-1 ring-white/10">
              <Sparkles className="h-7 w-7 text-brand-300" />
            </div>
            <h3 className="text-lg font-semibold text-white">Turn this PDF into a question bank</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              Pick how many questions, the type and difficulty, then hit generate. You can download the result as a PDF.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function ProgressCard({ progress }: { progress: QAProgress | null }) {
  if (!progress) return null
  const pct = progress.totalSections ? Math.round(((progress.section - 0.5) / progress.totalSections) * 100) : 5
  return (
    <div className="card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
      <Spinner className="h-8 w-8" />
      <h3 className="mt-4 font-semibold text-white">Reading your document…</h3>
      <p className="mt-1 text-sm text-slate-400">
        {progress.section > 0 ? `Section ${progress.section} of ${progress.totalSections}` : 'Planning sections'} · {plural(progress.found, 'question')} so far
      </p>
      <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all duration-500" style={{ width: `${Math.max(5, pct)}%` }} />
      </div>
      {progress.waitingMs && (
        <p className="mt-4 text-xs text-amber-300/90">Groq free-tier limit hit — retrying in {Math.round(progress.waitingMs / 1000)}s…</p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function Chip({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
        active ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/60' : 'bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
