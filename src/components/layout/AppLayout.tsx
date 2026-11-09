import { Building2, ListChecks, LogOut, Menu, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useProfile } from '@/auth/auth-context'
import { BrandMark } from '@/components/BrandMark'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ROLE_LABEL } from '@/lib/status'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

function useNavItems(): NavItem[] {
  const profile = useProfile()
  return [
    { to: '/sites', label: 'Объекты', icon: Building2 },
    { to: '/tasks', label: profile.role === 'manager' ? 'Все задачи' : 'Мои задачи', icon: ListChecks },
  ]
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNavItems()
  return (
    <nav aria-label="Основная навигация" className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
              isActive
                ? 'bg-card text-foreground shadow-xs ring-1 ring-black/5'
                : 'text-muted-foreground hover:bg-stone-200/50 hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span aria-hidden className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
              )}
              <Icon className={cn('size-4', isActive ? 'text-brand-strong' : 'text-stone-400 group-hover:text-stone-600')} aria-hidden />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function UserPanel() {
  const profile = useProfile()
  const { session, signOut } = useAuth()
  const [pending, setPending] = useState(false)

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-3">
        <UserAvatar name={profile.full_name} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{profile.full_name}</div>
          <div className="truncate text-xs text-muted-foreground" title={session?.user.email}>
            {session?.user.email}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
            profile.role === 'manager'
              ? 'bg-brand-soft text-brand-foreground ring-amber-600/20'
              : 'bg-stone-100 text-stone-700 ring-stone-500/15',
          )}
        >
          {ROLE_LABEL[profile.role]}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          disabled={pending}
          onClick={() => {
            setPending(true)
            void signOut().finally(() => setPending(false))
          }}
        >
          <LogOut /> Выйти
        </Button>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8 px-5 py-6">
      <BrandMark />
      <div className="flex-1">
        <div className="mb-2 px-3 text-[11px] font-medium tracking-wider text-stone-400 uppercase">Рабочее пространство</div>
        <Navigation onNavigate={onNavigate} />
      </div>
      <UserPanel />
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Перейти к содержимому
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <BrandMark />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Открыть меню">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <SheetDescription className="sr-only">Навигация по приложению</SheetDescription>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <main id="main" className="lg:pl-64">
        <div key={location.pathname} className="mx-auto w-full max-w-6xl px-4 py-6 animate-in fade-in-0 duration-200 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
