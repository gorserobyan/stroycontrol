import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useCreateSite, useUpdateSite } from '@/api/sites'
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
import { getErrorMessage } from '@/lib/errors'
import type { Site } from '@/lib/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Введите название объекта').max(200, 'Не более 200 символов'),
  address: z.string().trim().min(1, 'Введите адрес объекта').max(500, 'Не более 500 символов'),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface SiteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog edits this site, otherwise creates a new one. */
  site?: Site
  onCreated?: (site: Site) => void
}

export function SiteFormDialog({ open, onOpenChange, site, onCreated }: SiteFormDialogProps) {
  const create = useCreateSite()
  const update = useUpdateSite()
  const isEdit = Boolean(site)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '' },
  })

  useEffect(() => {
    if (open) reset({ name: site?.name ?? '', address: site?.address ?? '' })
  }, [open, site, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (site) {
        await update.mutateAsync({ id: site.id, ...values })
        toast.success('Объект обновлён')
      } else {
        const created = await create.mutateAsync(values)
        toast.success('Объект создан', { description: created.name })
        onCreated?.(created)
      }
      onOpenChange(false)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        setError('name', { message: 'Объект с таким названием уже существует' })
        return
      }
      toast.error(isEdit ? 'Не удалось сохранить объект' : 'Не удалось создать объект', {
        description: getErrorMessage(error),
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактирование объекта' : 'Новый объект'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Измените название или адрес строительного объекта.' : 'Добавьте строительный объект, чтобы назначать по нему задачи.'}
          </DialogDescription>
        </DialogHeader>

        <form id="site-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">Название</Label>
            <Input
              id="site-name"
              placeholder="Например, ЖК Северный квартал"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'site-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="site-name-error" className="text-xs text-rose-600">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-address">Адрес</Label>
            <Input
              id="site-address"
              placeholder="Город, улица, дом"
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? 'site-address-error' : undefined}
              {...register('address')}
            />
            {errors.address && (
              <p id="site-address-error" className="text-xs text-rose-600">
                {errors.address.message}
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Отмена
            </Button>
          </DialogClose>
          <Button type="submit" form="site-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" />}
            {isEdit ? 'Сохранить' : 'Создать объект'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
