import { countByStatus, STATUS_META, STATUS_ORDER } from '@/lib/status'
import type { TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Segmented bar + legend of task statuses. */
export function StatusBreakdown({ tasks }: { tasks: { status: TaskStatus }[] }) {
  const counts = countByStatus(tasks)
  const total = tasks.length

  if (total === 0) {
    return (
      <div className="space-y-3">
        <div className="h-1.5 rounded-full bg-stone-100" />
        <p className="text-xs text-muted-foreground">Задач пока нет</p>
      </div>
    )
  }

  const present = STATUS_ORDER.filter((s) => counts[s] > 0)
  const summary = present.map((s) => `${STATUS_META[s].label}: ${counts[s]}`).join(', ')

  return (
    <div className="space-y-3">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={summary}>
        {present.map((s) => (
          <div key={s} className={cn('h-full first:rounded-l-full last:rounded-r-full', STATUS_META[s].dot)} style={{ width: `${(counts[s] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5" aria-hidden>
        {present.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', STATUS_META[s].dot)} />
            {STATUS_META[s].label}
            <span className="font-medium text-foreground tabular-nums">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
