import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local')
}

export const SUPABASE_URL = url ?? 'http://localhost:54321'
export const SUPABASE_ANON_KEY = anonKey ?? 'missing-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
