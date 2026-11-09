import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface NotFoundStateProps {
  title: string
  description: string
  backTo: string
  backLabel: string
}

/**
 * Shown both for missing records and for records the user may not see:
 * RLS makes them indistinguishable on purpose, so we never confirm that a
 * hidden record exists.
 */
export function NotFoundState({ title, description, backTo, backLabel }: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card shadow-xs">
        <SearchX className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to={backTo}>
          <ArrowLeft /> {backLabel}
        </Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Страница не найдена')
  return (
    <NotFoundState
      title="Страница не найдена"
      description="Возможно, ссылка устарела или в адресе есть опечатка."
      backTo="/sites"
      backLabel="На главную"
    />
  )
}
