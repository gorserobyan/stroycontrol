import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Undo2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useTransitionTask } from '@/api/tasks'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/errors'

const schema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Комментарий обязателен: опишите, что нужно доработать')
    .max(2000, 'Не более 2000 символов'),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface ReworkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskTitle: string
}

export function ReworkDialog({ open, onOpenChange, taskId, taskTitle }: ReworkDialogProps) {
  const transition = useTransitionTask()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { comment: '' } })

  useEffect(() => {
    if (open) reset({ comment: '' })
  }, [open, reset])

  const length = useWatch({ control, name: 'comment' }).length

  const onSubmit = handleSubmit(async ({ comment }) => {
    try {
      await transition.mutateAsync({ id: taskId, to: 'rework', comment })
      toast.success('Задача возвращена на доработку')
      onOpenChange(false)
    } catch (error) {
      toast.error('Не удалось вернуть задачу', { description: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Вернуть на доработку</DialogTitle>
          <DialogDescription>
            Задача «{taskTitle}» вернётся исполнителю. Комментарий увидит исполнитель и он сохранится в истории.
          </DialogDescription>
        </DialogHeader>
        <form id="rework-form" onSubmit={onSubmit} noValidate className="space-y-2">
          <Label htmlFor="rework-comment">Что нужно доработать</Label>
          <Textarea
            id="rework-comment"
            rows={5}
            autoFocus
            placeholder="Опишите замечания: что именно исправить и как подтвердить результат"
            aria-invalid={Boolean(errors.comment)}
            aria-describedby={errors.comment ? 'rework-comment-error' : 'rework-comment-hint'}
            {...register('comment')}
          />
          <div className="flex justify-between gap-4 text-xs">
            {errors.comment ? (
              <p id="rework-comment-error" className="text-rose-600">
                {errors.comment.message}
              </p>
            ) : (
              <p id="rework-comment-hint" className="text-muted-foreground">
                Обязательное поле
              </p>
            )}
            <span className="shrink-0 text-muted-foreground tabular-nums">{length}/2000</span>
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Отмена
            </Button>
          </DialogClose>
          <Button type="submit" form="rework-form" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Undo2 />}
            Вернуть на доработку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
