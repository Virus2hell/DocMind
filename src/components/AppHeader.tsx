import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

export function AppHeader() {
  const { session, signOut } = useAuth()
  const user = session?.user
  const label = user?.is_anonymous ? 'Guest' : user?.email

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo to="/app" />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:flex">
            <UserRound className="h-3.5 w-3.5" />
            {label}
          </span>
          <button onClick={signOut} className="btn-ghost px-3 py-2" title="Sign out">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
