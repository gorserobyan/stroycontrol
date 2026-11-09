import { LoaderCircle } from 'lucide-react'

export function FullPageLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </div>
    </div>
  )
}
