import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { AuthContext, type AuthContextValue, type ProfileState } from './auth-context'

/** Read synchronously at startup, before supabase-js may discard an unrestorable session. */
const HAD_STORED_SESSION = (() => {
  try {
    return localStorage.getItem('stroycontrol-auth') !== null
  } catch {
    return false
  }
})()

function notifySessionExpired(): void {
  toast.warning('Сессия истекла', { description: 'Войдите снова, чтобы продолжить работу.' })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const manualSignOutRef = useRef(false)
  const restoringRef = useRef(HAD_STORED_SESSION)

  useEffect(() => {
    // onAuthStateChange emits INITIAL_SESSION with the restored session, then
    // SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT. Never await Supabase calls in
    // this callback (it runs inside the auth lock).
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      const nextUserId = next?.user.id ?? null

      if (restoringRef.current) {
        // A session was stored on this device but could not be restored (refresh token expired/revoked).
        restoringRef.current = false
        if (!next) notifySessionExpired()
      }

      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        if (userIdRef.current && !manualSignOutRef.current) notifySessionExpired()
        manualSignOutRef.current = false
      } else if (nextUserId !== userIdRef.current && userIdRef.current !== null) {
        // A different account signed in on this device: drop the old cache.
        queryClient.clear()
      }

      userIdRef.current = nextUserId
      setSession(next)
      setInitialized(true)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id ?? null

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: userId !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('id', userId ?? '')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const profileState: ProfileState = useMemo(() => {
    if (userId === null) return { status: 'idle' }
    if (profileQuery.isPending) return { status: 'loading' }
    if (profileQuery.isError) {
      return { status: 'error', error: profileQuery.error, retry: () => void profileQuery.refetch() }
    }
    return profileQuery.data ? { status: 'ready', profile: profileQuery.data } : { status: 'missing' }
  }, [userId, profileQuery])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error
  }, [])

  const signOut = useCallback(async () => {
    manualSignOutRef.current = true
    const { error } = await supabase.auth.signOut()
    // If the server is unreachable, still end the session on this device.
    if (error) await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ initialized, session, profileState, signIn, signOut }),
    [initialized, session, profileState, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
