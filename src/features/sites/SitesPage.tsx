import { ArrowRight, Building2, Ellipsis, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSites } from '@/api/sites'
import { useProfile } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, plural, TASK_FORMS } from '@/lib/format'
import type { SiteSummary } from '@/lib/types'
import { ArchiveSiteDialog } from './ArchiveSiteDialog'
import { SiteFormDialog } from './SiteFormDialog'
import { StatusBreakdown } from './StatusBreakdown'

function SiteCard({
  site,
  isManager,
  onEdit,
  onArchive,
}: {
  site: SiteSummary
  isManager: boolean
  onEdit: () => void
  onArchive: () => void
}) {
  const total = site.tasks.length
  const open = site.tasks.filter((t) => t.status !== 'accepted').length

  return (
    <article className="group relative flex flex-col rounded-xl border bg-card shadow-xs transition-all hover:border-stone-300 hover:shadow-md hover:shadow-stone-900/[0.04]">
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft ring-1 ring-amber-600/10">
          <Building2 className="size-5 text-brand-strong" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">
            <Link
              to={`/sites/${site.id}`}
              className="rounded-sm after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
            >
              {site.name}
            </Link>
          </h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{site.address}</span>
          </p>
        </div>
        {isManager && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative z-10 -mt-1 -mr-2 text-muted-foreground" aria-label={`Действия с объектом ${site.name}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Редактировать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onArchive}>
                <Trash2 /> Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="mb-3 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{total}</span>
          <span className="text-sm text-muted-foreground">{plural(total, TASK_FORMS)}</span>
          {total > 0 && <span className="ml-auto text-xs text-muted-foreground">открыто: {open}</span>}
        </div>
        <StatusBreakdown tasks={site.tasks} />
      </div>

      <div className="mt-auto flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>Создан {formatDate(site.created_at)}</span>
        <span className="flex items-center gap-1 font-medium text-foreground transition-colors group-hover:text-brand-strong">
          Открыть <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </article>
  )
}

function SitesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Загрузка объектов">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex gap-3.5">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
          <Skeleton className="mt-6 h-7 w-16" />
          <Skeleton className="mt-3 h-1.5 w-full" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function SitesPage() {
  useDocumentTitle('Объекты')
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const navigate = useNavigate()
  const sites = useSites()

  const [createOpen, setCreateOpen] = useState(false)
  // Target is kept after closing so dialog content doesn't change during the exit animation.
  const [editing, setEditing] = useState<SiteSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [archiving, setArchiving] = useState<SiteSummary | null>(null)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Объекты"
        description={
          isManager
            ? 'Строительные объекты компании и состояние задач по ним.'
            : 'Объекты, на которых вам назначены задачи. Статистика учитывает только ваши задачи.'
        }
        actions={
          isManager && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Создать объект
            </Button>
          )
        }
      />

      {sites.isPending ? (
        <SitesSkeleton />
      ) : sites.isError ? (
        <ErrorState error={sites.error} onRetry={() => void sites.refetch()} />
      ) : sites.data.length === 0 ? (
        isManager ? (
          <EmptyState
            icon={Building2}
            title="Объектов пока нет"
            description="Создайте первый строительный объект, чтобы начать назначать задачи исполнителям."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Создать объект
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Нет доступных объектов"
            description="Объект появится здесь, как только постановщик назначит вам задачу на нём."
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sites.data.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              isManager={isManager}
              onEdit={() => {
                setEditing(site)
                setEditOpen(true)
              }}
              onArchive={() => setArchiving(site)}
            />
          ))}
        </div>
      )}

      {isManager && (
        <>
          <SiteFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(s) => navigate(`/sites/${s.id}`)} />
          {editing && <SiteFormDialog open={editOpen} onOpenChange={setEditOpen} site={editing} />}
          {archiving && (
            <ArchiveSiteDialog
              open
              onOpenChange={(o) => !o && setArchiving(null)}
              site={archiving}
              activeTaskCount={archiving.tasks.length}
            />
          )}
        </>
      )}
    </div>
  )
}
