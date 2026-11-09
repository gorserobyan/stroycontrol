import { toast } from 'sonner'
import { useArchiveSite } from '@/api/sites'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { plural, TASK_FORMS } from '@/lib/format'

interface ArchiveSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: { id: string; name: string }
  activeTaskCount: number
  onArchived?: () => void
}

export function ArchiveSiteDialog({ open, onOpenChange, site, activeTaskCount, onArchived }: ArchiveSiteDialogProps) {
  const archive = useArchiveSite()

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      pending={archive.isPending}
      title={`Удалить объект «${site.name}»?`}
      confirmLabel="Удалить объект"
      description={
        <div className="space-y-2">
          <p>Объект исчезнет из списков и станет недоступен пользователям.</p>
          {activeTaskCount > 0 && (
            <p className="font-medium text-foreground">
              Вместе с ним будут удалены {activeTaskCount} {plural(activeTaskCount, TASK_FORMS)}.
            </p>
          )}
          <p>Записи переносятся в архив: история статусов сохраняется в базе данных.</p>
        </div>
      }
      onConfirm={() => {
        archive.mutate(site.id, {
          onSuccess: (count) => {
            toast.success('Объект удалён', {
              description: count > 0 ? `В архив перенесено: ${count} ${plural(count, TASK_FORMS)}` : site.name,
            })
            onOpenChange(false)
            onArchived?.()
          },
          onError: (error) => toast.error('Не удалось удалить объект', { description: getErrorMessage(error) }),
        })
      }}
    />
  )
}
