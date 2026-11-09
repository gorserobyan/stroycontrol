import { format, formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDate(value: string): string {
  return format(new Date(value), 'd MMM yyyy', { locale: ru })
}

export function formatDateTime(value: string): string {
  return format(new Date(value), "d MMMM yyyy, HH:mm", { locale: ru })
}

export function formatRelative(value: string): string {
  return formatDistanceToNow(new Date(value), { locale: ru, addSuffix: true })
}

/** Russian plural: plural(5, ['задача', 'задачи', 'задач']) → 'задач'. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const TASK_FORMS = ['задача', 'задачи', 'задач'] as const

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
