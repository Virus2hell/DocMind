import { useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import type { QAItem } from '../types'

const TYPE_BADGE: Record<QAItem['type'], string> = {
  short: 'Short',
  mcq: 'MCQ',
  true_false: 'True/False',
}

export function QAList({ items, hideAnswers }: { items: QAItem[]; hideAnswers: boolean }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <QACard key={`${i}-${hideAnswers}`} index={i} item={item} hideAnswers={hideAnswers} />
      ))}
    </ol>
  )
}

function QACard({ index, item, hideAnswers }: { index: number; item: QAItem; hideAnswers: boolean }) {
  // the parent's key changes when "Study mode" toggles, which resets this state
  const [revealed, setRevealed] = useState(!hideAnswers)

  return (
    <li className="card animate-fade-up p-5" style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-300">{index + 1}</span>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {TYPE_BADGE[item.type]}
        </span>
        {item.page != null && <span className="ml-auto text-[11px] text-slate-500">p. {item.page}</span>}
      </div>

      <p className="font-medium leading-relaxed text-white">{item.question}</p>

      {item.options && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {item.options.map((opt, j) => {
            const correct = revealed && opt === item.answer
            return (
              <li
                key={j}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  correct ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.02] text-slate-300'
                }`}
              >
                <span className="font-semibold text-slate-500">{'ABCD'[j]}.</span>
                <span className="flex-1">{opt}</span>
                {correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
              </li>
            )
          })}
        </ul>
      )}

      {revealed ? (
        <div className="mt-3 rounded-xl border-l-2 border-emerald-400/70 bg-emerald-400/[0.06] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90">Answer</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-200">{item.answer}</p>
          {item.explanation && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.explanation}</p>}
        </div>
      ) : (
        <button onClick={() => setRevealed(true)} className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
          <ChevronDown className="h-3.5 w-3.5" /> Reveal answer
        </button>
      )}
    </li>
  )
}
