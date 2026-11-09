import { BrandMark } from '@/components/BrandMark'

/** Shown when the build has no public Supabase configuration. */
export function ConfigMissing() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4">
      <BrandMark />
      <div role="alert" className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-lg font-semibold">Приложение не настроено</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Не заданы переменные окружения Supabase. Скопируйте <code className="rounded bg-stone-100 px-1">.env.example</code> в{' '}
          <code className="rounded bg-stone-100 px-1">.env.local</code>, укажите URL проекта и публичный ключ и перезапустите сборку.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-stone-950 p-4 text-xs text-stone-200">
          {'VITE_SUPABASE_URL=...\nVITE_SUPABASE_PUBLISHABLE_KEY=...'}
        </pre>
      </div>
    </div>
  )
}
