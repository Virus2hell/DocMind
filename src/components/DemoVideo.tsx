import { useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'

/**
 * Hero demo video.
 * Put your screen recording at  public/demo.mp4  (and optionally public/demo-poster.jpg).
 * Until that file exists, an animated mock-up of the app is shown instead.
 */
export function DemoVideo() {
  const [hasVideo, setHasVideo] = useState(true)

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* glow behind the frame */}
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-brand-600/30 via-brand-500/10 to-accent-400/30 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/50">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-ink-800 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <span className="h-3 w-3 rounded-full bg-green-400/80" />
          <div className="ml-4 hidden flex-1 rounded-md bg-ink-950/70 px-3 py-1 text-xs text-slate-500 sm:block">
            docmind.app/app
          </div>
        </div>

        <div className="aspect-video">
          {hasVideo ? (
            <video
            className="h-full w-full object-cover"
            src="/demo.mp4"
            poster="/demo-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            onError={() => setHasVideo(false)}
          />
          ) : (
            <MockApp />
          )}
        </div>
      </div>
    </div>
  )
}

/** Animated placeholder that looks like the app, used until demo.mp4 exists. */
function MockApp() {
  return (
    <div className="grid h-full grid-cols-1 text-left sm:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-white/10 bg-ink-950/50 p-4 sm:block">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Documents</p>
        {['Operating Systems.pdf', 'Marketing Plan.pdf', 'Biology Ch-4.pdf'].map((d, i) => (
          <div
            key={d}
            className={`mb-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${i === 0 ? 'bg-brand-500/15 text-brand-300' : 'text-slate-400'}`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d}</span>
          </div>
        ))}
      </aside>
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg bg-brand-500/20 px-3 py-1.5 font-medium text-brand-300">Chat</span>
          <span className="rounded-lg px-3 py-1.5 text-slate-500">Generate Q&A</span>
        </div>
        <div className="ml-auto max-w-[75%] animate-fade-up rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-xs text-white sm:text-sm">
          What is a deadlock and how can it be prevented?
        </div>
        <div className="max-w-[85%] animate-fade-up rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-slate-300 [animation-delay:0.8s] sm:text-sm">
          <p>
            A <b className="text-white">deadlock</b> happens when processes wait on each other's resources forever{' '}
            <span className="text-brand-300">(p. 12)</span>. It can be prevented by breaking one of the four Coffman
            conditions — e.g. ordering resource requests <span className="text-brand-300">(p. 14)</span>
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-brand-400" />
          </p>
          <div className="mt-2 flex gap-1.5">
            {['p. 12', 'p. 14'].map((p) => (
              <span key={p} className="rounded-md border border-white/10 bg-ink-950/60 px-2 py-0.5 text-[10px] text-slate-400">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" /> Ask anything about your PDF…
        </div>
      </div>
    </div>
  )
}
