import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { ConfigMissing } from '@/pages/ConfigMissing'
import { Toaster } from '@/components/ui/sonner'
import { isSessionExpiredError } from '@/lib/errors'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import './index.css'

/** An expired/invalid JWT ends the local session; AuthProvider then shows a notice and redirects to /login. */
function onApiError(error: unknown): void {
  if (isSessionExpiredError(error)) void supabase.auth.signOut({ scope: 'local' })
}

/** Permission / not-found / validation errors are deterministic — retrying them only delays feedback. */
const NON_RETRYABLE = new Set(['42501', 'P0002', 'PGRST116', 'PGRST301', 'PGRST302', 'PGRST303', '22023', '23514'])

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const code = (error as { code?: unknown }).code
        if (typeof code === 'string' && NON_RETRYABLE.has(code)) return false
        return failureCount < 2
      },
    },
  },
})

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster position="top-right" closeButton richColors={false} />
      </QueryClientProvider>
    ) : (
      <ConfigMissing />
    )}
  </StrictMode>,
)
