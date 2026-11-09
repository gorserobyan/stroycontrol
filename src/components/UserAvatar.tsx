import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-200/70 text-xs font-semibold text-stone-700 ring-1 ring-black/5',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
