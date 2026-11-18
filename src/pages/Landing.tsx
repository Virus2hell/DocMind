import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  Database,
  Download,
  FileUp,
  CodeXml,
  MessagesSquare,
  Quote,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { DemoVideo } from '../components/DemoVideo'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  { icon: FileUp, title: 'Upload a PDF', text: 'Your PDF is read in the browser, split into chunks and turned into embeddings stored in pgvector.' },
  { icon: MessagesSquare, title: 'Ask or generate', text: 'Chat with it, or pick 10–30 questions, a type and a difficulty to build a question bank.' },
  { icon: Download, title: 'Study & export', text: 'Answers cite their pages. Hide answers to quiz yourself, then download the Q&A as a PDF.' },
]

const FEATURES = [
  { icon: Quote, title: 'Page-level citations', text: 'Every answer points to the pages it came from, so you can verify it.' },
  { icon: BookOpenCheck, title: 'Q&A generator', text: 'Short answer, MCQ, true/false or mixed, at easy, medium or hard difficulty.' },
  { icon: Zap, title: 'Streaming answers', text: 'Powered by Groq, so responses start appearing almost instantly.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Row Level Security keeps each user’s documents visible only to them.' },
  { icon: Database, title: 'Real RAG pipeline', text: 'Chunking, gte-small embeddings and vector search with Supabase pgvector.' },
  { icon: Sparkles, title: 'Honest generation', text: 'If a PDF can’t support 30 good questions, you get fewer — never made-up ones.' },
]

const STACK = ['React', 'Vite', 'TypeScript', 'Tailwind', 'Supabase', 'pgvector', 'LangChain.js', 'Groq']

export default function Landing() {
  const { session } = useAuth()
  const ctaTo = session ? '/app' : '/login'

  return (
    <div className="relative overflow-hidden">
      <div className="glow pointer-events-none absolute inset-0 h-[900px]" />
      <div className="grid-bg pointer-events-none absolute inset-0 h-[900px]" />

      {/* ---------- Nav ---------- */}
      <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#how" className="hidden px-3 text-sm text-slate-400 hover:text-white sm:block">
            How it works
          </a>
          <a href="#features" className="hidden px-3 text-sm text-slate-400 hover:text-white sm:block">
            Features
          </a>
          <Link to={ctaTo} className="btn-primary">
            {session ? 'Open app' : 'Get started'} <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-20 text-center sm:px-6 sm:pt-20">
        <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-medium text-brand-200">
          <Sparkles className="h-3.5 w-3.5" /> RAG-powered study assistant
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl animate-fade-up text-4xl font-extrabold tracking-tight text-white [animation-delay:80ms] sm:text-6xl">
          Chat with your PDFs. <br className="hidden sm:block" />
          <span className="gradient-text">Turn them into Q&A.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base text-slate-400 [animation-delay:160ms] sm:text-lg">
          Upload any PDF, ask questions and get answers with page citations — or generate 10 to 30 questions with answers and
          download them as a ready-to-study PDF.
        </p>
        <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
          <Link to={ctaTo} className="btn-primary px-6 py-3 text-base">
            Try it free <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#demo" className="btn-ghost px-6 py-3 text-base">
            Watch the demo
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-500">No sign-up needed — continue as a guest.</p>

        <div id="demo" className="mt-16 animate-fade-up scroll-mt-24 [animation-delay:320ms]">
          <DemoVideo />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="How it works" title="From PDF to answers in three steps" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card relative p-6">
              <span className="absolute top-5 right-5 text-5xl font-extrabold text-white/[0.04]">0{i + 1}</span>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-accent-400/20 ring-1 ring-white/10">
                <s.icon className="h-5 w-5 text-brand-300" />
              </div>
              <h3 className="font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>

        {/* pipeline diagram */}
        <div className="card mt-8 overflow-x-auto p-6">
          <div className="flex min-w-[720px] items-center justify-between gap-2 text-xs">
            {['PDF', 'Text per page', 'Chunks', 'Embeddings', 'pgvector', 'Top-k chunks', 'Groq LLM', 'Answer + pages'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span
                  className={`rounded-lg border px-3 py-2 font-medium whitespace-nowrap ${
                    i === arr.length - 1 ? 'border-brand-500/50 bg-brand-500/15 text-brand-200' : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Features" title="Built like a real product" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 transition hover:border-brand-500/40 hover:bg-white/[0.05]">
              <f.icon className="h-5 w-5 text-brand-400" />
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {STACK.map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/30 via-ink-800 to-ink-900 p-10 text-center sm:p-14">
          <div className="glow absolute inset-0" />
          <h2 className="relative text-3xl font-bold text-white sm:text-4xl">Stop re-reading. Start asking.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-slate-300">Upload your first PDF and get answers in seconds.</p>
          <Link to={ctaTo} className="btn-primary relative mt-8 px-6 py-3 text-base">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>Built with React, Supabase pgvector, LangChain.js & Groq.</p>
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
            <CodeXml className="h-4 w-4" /> Source
          </a>
        </div>
      </footer>
    </div>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-brand-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
    </div>
  )
}
