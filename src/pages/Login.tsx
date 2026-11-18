import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, UserRound } from 'lucide-react'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'form' | 'guest' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  if (session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading('form')
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setLoading(null)
    if (error) return setError(error.message)
    if (mode === 'signup' && !data.session) setNotice('Check your inbox to confirm your email, then sign in.')
  }

  async function continueAsGuest() {
    setError(null)
    setLoading('guest')
    const { error } = await supabase.auth.signInAnonymously()
    setLoading(null)
    if (error) setError(`${error.message}. (Enable "Anonymous sign-ins" in Supabase → Authentication → Sign In / Providers.)`)
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-white">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-400">Your documents stay private to your account.</p>

          {!isConfigured && (
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your keys.
            </p>
          )}

          <button onClick={continueAsGuest} disabled={loading !== null} className="btn-ghost mt-6 w-full py-3">
            {loading === 'guest' ? <Spinner /> : <UserRound className="h-4 w-4" />} Continue as guest
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" /> or with email <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            {notice && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}
            <button type="submit" disabled={loading !== null} className="btn-primary w-full py-3">
              {loading === 'form' ? <Spinner className="h-4 w-4 text-white" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setNotice(null)
              }}
              className="font-semibold text-brand-300 hover:text-brand-200"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
