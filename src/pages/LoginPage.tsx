import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CircleAlert, Eye, EyeOff, History, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/auth-context'
import { BrandMark } from '@/components/BrandMark'
import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getErrorMessage } from '@/lib/errors'

const schema = z.object({
  email: z.string().trim().min(1, 'Введите email').pipe(z.email('Введите корректный email')),
  password: z.string().min(1, 'Введите пароль'),
})

type FormValues = z.input<typeof schema>

const CURRENT_YEAR = new Date().getFullYear()

const FEATURES = [
  { icon: Building2, title: 'Объекты и задачи', text: 'Все стройплощадки и поручения в одном месте.' },
  { icon: History, title: 'Прозрачная история', text: 'Каждое изменение статуса фиксируется с автором и временем.' },
  { icon: ShieldCheck, title: 'Защищённый доступ', text: 'Исполнители видят только свои задачи.' },
]

export function LoginPage() {
  useDocumentTitle('Вход')
  const { initialized, session, signIn } = useAuth()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (!initialized) return <FullPageLoader />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/sites'} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const error = await signIn(values.email, values.password)
      if (error) setFormError(getErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз.'))
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-stone-950 p-12 text-stone-100 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-amber-500/10 blur-3xl" />

        <BrandMark inverted className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">
            Контроль строительных работ без хаоса в мессенджерах
          </h2>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Icon className="size-4 text-amber-400" aria-hidden />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{title}</div>
                  <div className="mt-0.5 text-sm text-stone-400">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-stone-500">© {CURRENT_YEAR} СтройКонтроль</div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <BrandMark className="mb-10 lg:hidden" />

          <h1 className="text-2xl font-semibold tracking-tight">Вход в систему</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Используйте учётные данные, выданные администратором.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="name@company.ru"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 bg-card"
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-rose-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="h-10 bg-card pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-rose-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" />}
              {isSubmitting ? 'Вход…' : 'Войти'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Нет учётной записи? Обратитесь к администратору вашей компании.
          </p>
        </div>
      </main>
    </div>
  )
}
