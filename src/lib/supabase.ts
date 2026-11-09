import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** True when the public Supabase configuration is present. */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * Browser client. Uses ONLY the public URL + publishable/anon key.
 * Every authorization decision is made by Postgres (RLS, grants, RPCs);
 * nothing the browser sends is trusted.
 */
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  key ?? 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'stroycontrol-auth',
    },
  },
)
