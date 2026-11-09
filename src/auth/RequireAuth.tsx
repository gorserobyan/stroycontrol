import { CircleAlert, LogOut, RefreshCw, ShieldAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { BrandMark } from '@/components/BrandMark'
import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/errors'
import { useAuth } from './auth-context'

function CenteredNotice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-background px-4">
      <BrandMark />
      <div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-stone-100">{icon}</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/**
 * Gate for the application. Requires a session AND a provisioned profile.
 * This is a UX gate only — without a profile the database returns no data
 * and rejects every write regardless of what the browser renders.
 */
export function RequireAuth() {
  const { initialized, session, profileState, signOut } = useAuth()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)

  if (!initialized) return <FullPageLoader label="Восстанавливаем сессию…" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  const logoutButton = (
    <Button
      variant="outline"
      disabled={signingOut}
      onClick={() => {
        setSigningOut(true)
        void signOut().finally(() => setSigningOut(false))
      }}
    >
      <LogOut /> Выйти
    </Button>
  )

  switch (profileState.status) {
    case 'idle':
    case 'loading':
      return <FullPageLoader label="Загружаем профиль…" />
    case 'error':
      return (
        <CenteredNotice icon={<CircleAlert className="size-5 text-rose-600" />} title="Не удалось загрузить профиль">
          <p className="mt-2 text-sm text-muted-foreground">{getErrorMessage(profileState.error)}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={profileState.retry}>
              <RefreshCw /> Повторить
            </Button>
            {logoutButton}
          </div>
        </CenteredNotice>
      )
    case 'missing':
      return (
        <CenteredNotice icon={<ShieldAlert className="size-5 text-stone-600" />} title="Доступ не предоставлен">
          <p className="mt-2 text-sm text-muted-foreground">
            Ваша учётная запись ({session.user.email}) ещё не подключена к СтройКонтролю. Обратитесь к администратору, чтобы
            вам назначили роль.
          </p>
          <div className="mt-6 flex justify-center">{logoutButton}</div>
        </CenteredNotice>
      )
    case 'ready':
      return <Outlet />
  }
}
