import type { UseQueryResult } from '@tanstack/react-query'
import { FilterX } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { countByStatus, isTaskStatus, STATUS_META } from '@/lib/status'
import type { Task, TaskStatus } from '@/lib/types'
import { StatusFilter } from './StatusFilter'
import { TaskList, TaskListSkeleton } from './TaskList'

interface FilteredTaskListProps {
  query: UseQueryResult<Task[]>
  showSite?: boolean
  /** Shown when there are no tasks at all. */
  empty: ReactNode
}

/** Task list with a status filter persisted in the URL (?status=…). */
export function FilteredTaskList({ query, showSite = true, empty }: FilteredTaskListProps) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const status: TaskStatus | null = isTaskStatus(raw) ? raw : null

  const setStatus = (next: TaskStatus | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next) p.set('status', next)
        else p.delete('status')
        return p
      },
      { replace: true },
    )

  if (query.isPending) return <TaskListSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (query.data.length === 0) return <>{empty}</>

  const filtered = status ? query.data.filter((t) => t.status === status) : query.data

  return (
    <div className="space-y-4">
      <StatusFilter value={status} onChange={setStatus} counts={countByStatus(query.data)} total={query.data.length} />
      {filtered.length === 0 && status ? (
        <EmptyState
          icon={FilterX}
          title={`Нет задач в статусе «${STATUS_META[status].label}»`}
          description="Выберите другой статус или сбросьте фильтр."
          action={
            <Button variant="outline" size="sm" onClick={() => setStatus(null)}>
              Показать все задачи
            </Button>
          }
        />
      ) : (
        <TaskList tasks={filtered} showSite={showSite} />
      )}
    </div>
  )
}
