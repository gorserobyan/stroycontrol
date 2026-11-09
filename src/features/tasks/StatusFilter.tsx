import { STATUS_META, STATUS_ORDER } from '@/lib/status'
import type { TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StatusFilterProps {
  value: TaskStatus | null
  onChange: (value: TaskStatus | null) => void
  counts: Record<TaskStatus, number>
  total: number
}

export function StatusFilter({ value, onChange, counts, total }: StatusFilterProps) {
  const options: { key: TaskStatus | null; label: string; count: number; dot?: string }[] = [
    { key: null, label: 'Все', count: total },
    ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label, count: counts[s], dot: STATUS_META[s].dot })),
  ]

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Фильтр по статусу">
      <div className="inline-flex gap-1 rounded-lg border bg-card p-1 shadow-xs">
        {options.map((o) => {
          const active = value === o.key
          return (
            <button
              key={o.key ?? 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                active ? 'bg-stone-900 text-white shadow-sm' : 'text-muted-foreground hover:bg-stone-100 hover:text-foreground',
              )}
            >
              {o.dot && <span aria-hidden className={cn('size-1.5 rounded-full', o.dot)} />}
              {o.label}
              <span className={cn('tabular-nums', active ? 'text-stone-300' : 'text-stone-400')}>{o.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
