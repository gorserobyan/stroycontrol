import { HardHat } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-brand shadow-sm ring-1 ring-black/5">
        <HardHat className="size-[18px] text-stone-900" strokeWidth={2.2} aria-hidden />
      </div>
      <div className="leading-tight">
        <div className={cn('text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-foreground')}>
          СтройКонтроль
        </div>
        <div className={cn('text-[11px]', inverted ? 'text-stone-400' : 'text-muted-foreground')}>
          Управление объектами
        </div>
      </div>
    </div>
  )
}
