import { ArrowLeft, Building2, CalendarDays, CheckCheck, LoaderCircle, Lock, Pencil, Trash2, Undo2, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useArchiveTask, useTask, useTransitionTask } from '@/api/tasks'
import { useProfile } from '@/auth/auth-context'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { StatusBadge } from '@/components/StatusBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { executorActionFor, STATUS_META } from '@/lib/status'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NotFoundState } from '@/pages/NotFoundPage'
import { ReworkDialog } from './ReworkDialog'
import { TaskFormDialog } from './TaskFormDialog'
import { TaskTimeline } from './TaskTimeline'

function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-xs', className)}>
      {title && <h2 className="border-b px-5 py-3.5 text-sm font-semibold">{title}</h2>}
      <div className="p-5">{children}</div>
    </section>
  )
}

function MetaRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="mt-0.5 text-stone-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium break-words">{children}</dd>
      </div>
    </div>
  )
}

/** Workflow buttons. Rendering mirrors the DB transition table; the DB decides. */
function WorkflowActions({ task }: { task: Task }) {
  const profile = useProfile()
  const transition = useTransitionTask()
  const [reworkOpen, setReworkOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)

  const hint = STATUS_META[task.status].hint[profile.role]

  if (profile.role === 'executor') {
    const action = executorActionFor(task.status)
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {action ? (
          <Button
            className="w-full"
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate(
                { id: task.id, to: action.to },
                {
                  onSuccess: () => toast.success(action.success),
                  onError: (error) => toast.error('Не удалось изменить статус', { description: getErrorMessage(error) }),
                },
              )
            }
          >
            {transition.isPending ? <LoaderCircle className="animate-spin" /> : <action.icon />}
            {action.label}
          </Button>
        ) : (
          <NoActions status={task.status} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{hint}</p>
      {task.status === 'in_review' ? (
        <div className="flex flex-col gap-2">
          <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={transition.isPending} onClick={() => setAcceptOpen(true)}>
            <CheckCheck /> Принять задачу
          </Button>
          <Button variant="outline" className="w-full" disabled={transition.isPending} onClick={() => setReworkOpen(true)}>
            <Undo2 /> Вернуть на доработку
          </Button>
        </div>
      ) : (
        <NoActions status={task.status} />
      )}

      <ConfirmDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title="Принять задачу?"
        description={
          <p>
            Задача «{task.title}» получит статус «Принята». Это финальный статус — изменить его позже будет нельзя.
          </p>
        }
        confirmLabel="Принять задачу"
        pending={transition.isPending}
        onConfirm={() =>
          transition.mutate(
            { id: task.id, to: 'accepted' },
            {
              onSuccess: () => {
                toast.success('Задача принята')
                setAcceptOpen(false)
              },
              onError: (error) => {
                toast.error('Не удалось принять задачу', { description: getErrorMessage(error) })
                setAcceptOpen(false)
              },
            },
          )
        }
      />
      <ReworkDialog open={reworkOpen} onOpenChange={setReworkOpen} taskId={task.id} taskTitle={task.title} />
    </div>
  )
}

function NoActions({ status }: { status: Task['status'] }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-muted-foreground ring-1 ring-stone-200">
      <Lock className="size-3.5 shrink-0" aria-hidden />
      {status === 'accepted' ? 'Задача закрыта' : 'Сейчас нет доступных действий'}
    </div>
  )
}

function TaskDetailsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Загрузка задачи">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-7 w-2/3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

export function TaskDetailsPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const task = useTask(taskId)
  const archive = useArchiveTask()
  useDocumentTitle(task.data?.title ?? 'Задача')

  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const backTo = '/tasks'
  const backLabel = isManager ? 'Все задачи' : 'Мои задачи'

  if (task.isPending) return <TaskDetailsSkeleton />
  if (task.isError) return <ErrorState error={task.error} onRetry={() => void task.refetch()} />
  if (!task.data) {
    return (
      <NotFoundState
        title="Задача не найдена"
        description="Задача была удалена, переназначена другому исполнителю, или у вас нет к ней доступа."
        backTo={backTo}
        backLabel={backLabel}
      />
    )
  }

  const t = task.data

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> {backLabel}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2.5">
            <StatusBadge status={t.status} />
            <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">{t.title}</h1>
          </div>
          {isManager && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Редактировать
              </Button>
              <Button
                variant="outline"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setArchiveOpen(true)}
                aria-label="Удалить задачу"
              >
                <Trash2 /> <span className="hidden sm:inline">Удалить</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card title="Описание">
            {t.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line text-stone-700">{t.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Описание не указано.</p>
            )}
          </Card>
          <Card title="История изменений">
            <TaskTimeline taskId={t.id} />
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-10">
          <Card title="Действия">
            <WorkflowActions task={t} />
          </Card>
          <Card>
            <dl className="divide-y">
              <MetaRow icon={<Building2 className="size-4" />} label="Объект">
                {t.site ? (
                  <Link to={`/sites/${t.site.id}`} className="hover:text-brand-strong hover:underline">
                    {t.site.name}
                  </Link>
                ) : (
                  '—'
                )}
                {t.site && <span className="block text-xs font-normal text-muted-foreground">{t.site.address}</span>}
              </MetaRow>
              <MetaRow icon={<UserRound className="size-4" />} label="Исполнитель">
                <span className="flex items-center gap-2">
                  {t.assignee && <UserAvatar name={t.assignee.full_name} className="size-6 text-[10px]" />}
                  {t.assignee?.full_name ?? '—'}
                </span>
              </MetaRow>
              <MetaRow icon={<UserRound className="size-4" />} label="Постановщик">
                {t.author?.full_name ?? '—'}
              </MetaRow>
              <MetaRow icon={<CalendarDays className="size-4" />} label="Создана">
                <time dateTime={t.created_at} title={formatDateTime(t.created_at)}>
                  {formatDate(t.created_at)}
                </time>
              </MetaRow>
            </dl>
          </Card>
        </div>
      </div>

      {isManager && (
        <>
          <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={t} />
          <ConfirmDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            destructive
            pending={archive.isPending}
            title="Удалить задачу?"
            description={
              <p>
                Задача «{t.title}» исчезнет из списков и у исполнителя. Запись и история статусов сохранятся в архиве базы
                данных.
              </p>
            }
            confirmLabel="Удалить задачу"
            onConfirm={() =>
              archive.mutate(t.id, {
                onSuccess: () => {
                  toast.success('Задача удалена')
                  setArchiveOpen(false)
                  navigate('/tasks', { replace: true })
                },
                onError: (error) => toast.error('Не удалось удалить задачу', { description: getErrorMessage(error) }),
              })
            }
          />
        </>
      )}
    </div>
  )
}
