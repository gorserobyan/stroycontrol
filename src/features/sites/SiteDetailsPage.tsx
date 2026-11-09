import { ArrowLeft, CalendarDays, ClipboardList, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useSite } from '@/api/sites'
import { useTasks } from '@/api/tasks'
import { useProfile } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, plural, TASK_FORMS } from '@/lib/format'
import { FilteredTaskList } from '@/features/tasks/FilteredTaskList'
import { TaskFormDialog } from '@/features/tasks/TaskFormDialog'
import { NotFoundState } from '@/pages/NotFoundPage'
import { ArchiveSiteDialog } from './ArchiveSiteDialog'
import { SiteFormDialog } from './SiteFormDialog'

function BackLink() {
  return (
    <Link
      to="/sites"
      className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <ArrowLeft className="size-3.5" aria-hidden /> Объекты
    </Link>
  )
}

export function SiteDetailsPage() {
  const { siteId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useProfile()
  const isManager = profile.role === 'manager'

  const site = useSite(siteId)
  const tasks = useTasks(siteId)
  useDocumentTitle(site.data?.name ?? 'Объект')

  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  if (site.isPending) {
    return (
      <div className="space-y-8" aria-busy="true">
        <BackLink />
        <div className="space-y-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (site.isError) {
    return (
      <div className="space-y-8">
        <BackLink />
        <ErrorState error={site.error} onRetry={() => void site.refetch()} />
      </div>
    )
  }

  if (!site.data) {
    return (
      <NotFoundState
        title="Объект не найден"
        description="Объект был удалён или у вас нет к нему доступа."
        backTo="/sites"
        backLabel="К списку объектов"
      />
    )
  }

  const s = site.data
  const taskCount = tasks.data?.length ?? 0

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<BackLink />}
        title={s.name}
        description={
          <span className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {s.address}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden /> Создан {formatDate(s.created_at)}
            </span>
            {tasks.isSuccess && (
              <span className="flex items-center gap-1.5">
                <ClipboardList className="size-3.5 shrink-0" aria-hidden />
                {isManager ? '' : 'Ваших: '}
                {taskCount} {plural(taskCount, TASK_FORMS)}
              </span>
            )}
          </span>
        }
        actions={
          isManager && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Редактировать
              </Button>
              <Button variant="outline" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setArchiveOpen(true)}>
                <Trash2 /> Удалить
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Новая задача
              </Button>
            </>
          )
        }
      />

      <section aria-labelledby="site-tasks-heading" className="space-y-4">
        <h2 id="site-tasks-heading" className="text-sm font-semibold">
          {isManager ? 'Задачи по объекту' : 'Ваши задачи по объекту'}
        </h2>
        <FilteredTaskList
          query={tasks}
          showSite={false}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="На объекте пока нет задач"
              description={isManager ? 'Создайте первую задачу и назначьте исполнителя.' : undefined}
              action={
                isManager && (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus /> Новая задача
                  </Button>
                )
              }
            />
          }
        />
      </section>

      {isManager && (
        <>
          <SiteFormDialog open={editOpen} onOpenChange={setEditOpen} site={s} />
          <ArchiveSiteDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            site={s}
            activeTaskCount={taskCount}
            onArchived={() => navigate('/sites', { replace: true })}
          />
          <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultSiteId={s.id} />
        </>
      )}
    </div>
  )
}
