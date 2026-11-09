import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/errors'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-600/10">
        <CircleAlert className="size-5 text-rose-600" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">Не удалось загрузить данные</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw /> Повторить
        </Button>
      )}
    </div>
  )
}
