import { zodResolver } from '@hookform/resolvers/zod'
import { Info, LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSites } from '@/api/sites'
import { useCreateTask, useExecutors, useUpdateTask } from '@/api/tasks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/errors'
import type { Task } from '@/lib/types'

// Note: there is intentionally no status field. Status changes go through the
// workflow RPC only; the database rejects status writes from this form.
const schema = z.object({
  title: z.string().trim().min(1, 'Введите название задачи').max(300, 'Не более 300 символов'),
  description: z.string().trim().max(5000, 'Не более 5000 символов'),
  site_id: z.string().min(1, 'Выберите объект'),
  assignee_id: z.string().min(1, 'Выберите исполнителя'),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  defaultSiteId?: string
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs text-rose-600">
      {message}
    </p>
  )
}

export function TaskFormDialog({ open, onOpenChange, task, defaultSiteId }: TaskFormDialogProps) {
  const navigate = useNavigate()
  const sites = useSites()
  const executors = useExecutors(open)
  const create = useCreateTask()
  const update = useUpdateTask()
  const isEdit = Boolean(task)
  const locked = task?.status === 'accepted'

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', site_id: '', assignee_id: '' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      site_id: task?.site_id ?? defaultSiteId ?? '',
      assignee_id: task?.assignee_id ?? '',
    })
  }, [open, task, defaultSiteId, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (task) {
        await update.mutateAsync({ id: task.id, ...values })
        toast.success('Задача обновлена')
      } else {
        const created = await create.mutateAsync(values)
        toast.success('Задача создана', {
          description: values.title,
          action: { label: 'Открыть', onClick: () => navigate(`/tasks/${created.id}`) },
        })
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEdit ? 'Не удалось сохранить задачу' : 'Не удалось создать задачу', {
        description: getErrorMessage(error),
      })
    }
  })

  const noExecutors = executors.isSuccess && executors.data.length === 0

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактирование задачи' : 'Новая задача'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Измените описание, объект или исполнителя. Статус меняется только действиями в карточке задачи.'
              : 'Задача будет создана в статусе «Новая» и сразу появится у исполнителя.'}
          </DialogDescription>
        </DialogHeader>

        <form id="task-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Название</Label>
            <Input
              id="task-title"
              placeholder="Например, проверить электропроводку на 3 этаже"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              {...register('title')}
            />
            <FieldError id="task-title-error" message={errors.title?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">
              Описание <span className="font-normal text-muted-foreground">(необязательно)</span>
            </Label>
            <Textarea
              id="task-description"
              rows={4}
              placeholder="Что нужно сделать, требования к результату"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'task-description-error' : undefined}
              {...register('description')}
            />
            <FieldError id="task-description-error" message={errors.description?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-site">Объект</Label>
              <Controller
                control={control}
                name="site_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={locked || sites.isPending}>
                    <SelectTrigger
                      id="task-site"
                      className="w-full"
                      aria-invalid={Boolean(errors.site_id)}
                      aria-describedby={errors.site_id ? 'task-site-error' : undefined}
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder={sites.isPending ? 'Загрузка…' : 'Выберите объект'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.data?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError id="task-site-error" message={errors.site_id?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-assignee">Исполнитель</Label>
              <Controller
                control={control}
                name="assignee_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={locked || executors.isPending || noExecutors}>
                    <SelectTrigger
                      id="task-assignee"
                      className="w-full"
                      aria-invalid={Boolean(errors.assignee_id)}
                      aria-describedby={errors.assignee_id ? 'task-assignee-error' : undefined}
                      onBlur={field.onBlur}
                    >
                      <SelectValue
                        placeholder={executors.isPending ? 'Загрузка…' : noExecutors ? 'Нет исполнителей' : 'Выберите исполнителя'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {executors.data?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError id="task-assignee-error" message={errors.assignee_id?.message} />
            </div>
          </div>

          {locked && (
            <p className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-muted-foreground ring-1 ring-stone-200">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              Задача принята: объект и исполнителя изменить нельзя, чтобы сохранить достоверность учёта.
            </p>
          )}
          {isEdit && !locked && task?.status !== 'new' && (
            <p className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-muted-foreground ring-1 ring-stone-200">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              При смене исполнителя статус задачи сохраняется, а предыдущий исполнитель сразу теряет к ней доступ.
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Отмена
            </Button>
          </DialogClose>
          <Button type="submit" form="task-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" />}
            {isEdit ? 'Сохранить' : 'Создать задачу'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
