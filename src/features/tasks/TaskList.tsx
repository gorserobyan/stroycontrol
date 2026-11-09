import { Building2, ChevronRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { StatusBadge } from '@/components/StatusBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import type { Task } from '@/lib/types'

interface TaskListProps {
  tasks: Task[]
  showSite?: boolean
}

function Assignee({ task }: { task: Task }) {
  const name = task.assignee?.full_name ?? '—'
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} className="size-6 text-[10px]" />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** Responsive task list: table on md+, cards on mobile. */
export function TaskList({ tasks, showSite = true }: TaskListProps) {
  const navigate = useNavigate()

  const openRow = (event: MouseEvent, id: string) => {
    // Let real links / buttons inside the row behave normally.
    if ((event.target as HTMLElement).closest('a, button')) return
    navigate(`/tasks/${id}`)
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            {showSite && <col className="w-[22%]" />}
            <col className="w-[19%]" />
            <col className="w-36" />
            <col className="w-28" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="border-b bg-stone-50/70 text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Задача</th>
              {showSite && <th scope="col" className="px-4 py-2.5 font-medium">Объект</th>}
              <th scope="col" className="px-4 py-2.5 font-medium">Исполнитель</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Статус</th>
              <th scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">Создана</th>
              <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Открыть</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => (
              <tr key={task.id} onClick={(e) => openRow(e, task.id)} className="group cursor-pointer transition-colors hover:bg-stone-50/80">
                <td className="px-4 py-3">
                  <Link
                    to={`/tasks/${task.id}`}
                    className="block truncate font-medium text-foreground focus-visible:underline focus-visible:outline-none"
                  >
                    {task.title}
                  </Link>
                  {task.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>}
                </td>
                {showSite && (
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="block truncate">{task.site?.name ?? '—'}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <Assignee task={task} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{formatDate(task.created_at)}</td>
                <td className="px-2 py-3 text-right">
                  <ChevronRight className="size-4 text-stone-300 transition-colors group-hover:text-stone-500" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-2.5 md:hidden">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              to={`/tasks/${task.id}`}
              className="block rounded-xl border bg-card p-4 shadow-xs transition-colors active:bg-stone-50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium leading-snug">{task.title}</span>
                <StatusBadge status={task.status} className="mt-0.5" />
              </div>
              {showSite && task.site && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" aria-hidden /> {task.site.name}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <Assignee task={task} />
                <span className="shrink-0 tabular-nums">{formatDate(task.created_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export function TaskListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-busy="true" aria-label="Загрузка задач">
      <div className="border-b bg-stone-50/70 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
