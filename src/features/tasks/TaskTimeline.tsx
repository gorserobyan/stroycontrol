import { History } from 'lucide-react'
import { useTaskHistory } from '@/api/tasks'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/format'
import { ROLE_LABEL, STATUS_META, transitionLabel } from '@/lib/status'
import { cn } from '@/lib/utils'

export function TaskTimeline({ taskId }: { taskId: string }) {
  const history = useTaskHistory(taskId)

  if (history.isPending) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Загрузка истории">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-3 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (history.isError) return <ErrorState error={history.error} onRetry={() => void history.refetch()} />
  if (history.data.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> История пока пуста
      </p>
    )
  }

  // Newest first reads best for "what happened last".
  const entries = [...history.data].reverse()

  return (
    <ol className="relative">
      {entries.map((entry, index) => {
        const meta = STATUS_META[entry.to_status]
        const isLast = index === entries.length - 1
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />}
            <span
              aria-hidden
              className={cn('relative mt-1 size-[11px] shrink-0 rounded-full ring-4 ring-card', meta.dot, index === 0 && 'ring-offset-0')}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{transitionLabel(entry.from_status, entry.to_status)}</span>
                {entry.from_status && (
                  <span className="text-xs text-muted-foreground">
                    {STATUS_META[entry.from_status].label} → {meta.label}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-stone-700">{entry.actor?.full_name ?? 'Пользователь'}</span>
                {entry.actor && <span> · {ROLE_LABEL[entry.actor.role]}</span>}
                <span> · </span>
                <time dateTime={entry.created_at} title={formatRelative(entry.created_at)}>
                  {formatDateTime(entry.created_at)}
                </time>
              </div>
              {entry.comment && (
                <blockquote
                  className={cn(
                    'mt-2.5 rounded-lg border-l-2 bg-stone-50 px-3.5 py-2.5 text-sm whitespace-pre-line text-stone-700',
                    entry.to_status === 'rework' ? 'border-rose-400 bg-rose-50/60' : 'border-stone-300',
                  )}
                >
                  {entry.comment}
                </blockquote>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
