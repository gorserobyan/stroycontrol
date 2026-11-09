import type { AuthError, Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from '@/lib/types'

export type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  /** Authenticated, but no profile was provisioned → no application access. */
  | { status: 'missing' }
  | { status: 'ready'; profile: Profile }

export interface AuthContextValue {
  /** False until the persisted session has been restored. */
  initialized: boolean
  session: Session | null
  profileState: ProfileState
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/**
 * The signed-in user's profile. Only call below <RequireAuth>, which
 * guarantees it is loaded. The role is used for UI decisions only — the
 * database re-checks it on every request.
 */
export function useProfile(): Profile {
  const { profileState } = useAuth()
  if (profileState.status !== 'ready') throw new Error('useProfile used outside of an authenticated route')
  return profileState.profile
}
