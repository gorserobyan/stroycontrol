import type { LucideIcon } from 'lucide-react'
import { CheckCheck, Play, RotateCcw, Send } from 'lucide-react'
import type { TaskStatus, UserRole } from './types'

export const STATUS_ORDER: readonly TaskStatus[] = ['new', 'in_progress', 'in_review', 'rework', 'accepted']

interface StatusMeta {
  label: string
  /** Badge surface + text. */
  badge: string
  /** Solid colour for dots / bars. */
  dot: string
  /** Short explanation shown on the task page. */
  hint: Record<UserRole, string>
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  new: {
    label: 'Новая',
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/15',
    dot: 'bg-sky-500',
    hint: {
      manager: 'Задача назначена и ожидает, когда исполнитель возьмёт её в работу.',
      executor: 'Задача назначена вам. Возьмите её в работу, когда приступите.',
    },
  },
  in_progress: {
    label: 'В работе',
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    hint: {
      manager: 'Исполнитель выполняет задачу.',
      executor: 'Когда работа будет готова, отправьте задачу на проверку.',
    },
  },
  in_review: {
    label: 'На проверке',
    badge: 'bg-violet-50 text-violet-700 ring-violet-600/15',
    dot: 'bg-violet-500',
    hint: {
      manager: 'Исполнитель завершил работу. Примите задачу или верните её на доработку.',
      executor: 'Задача ожидает проверки постановщиком.',
    },
  },
  rework: {
    label: 'На доработке',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/15',
    dot: 'bg-rose-500',
    hint: {
      manager: 'Задача возвращена исполнителю с замечаниями.',
      executor: 'Постановщик вернул задачу с замечаниями. Ознакомьтесь с комментарием в истории и продолжите работу.',
    },
  },
  accepted: {
    label: 'Принята',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    dot: 'bg-emerald-500',
    hint: {
      manager: 'Работа принята. Это финальный статус.',
      executor: 'Работа принята постановщиком. Это финальный статус.',
    },
  },
}

export function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  return value != null && (STATUS_ORDER as readonly string[]).includes(value)
}

export interface ExecutorAction {
  to: TaskStatus
  label: string
  icon: LucideIcon
  success: string
}

/**
 * UI mirror of the database transition table — used only to decide which
 * buttons to render. The database (transition_task_status) is authoritative.
 */
export function executorActionFor(status: TaskStatus): ExecutorAction | null {
  switch (status) {
    case 'new':
      return { to: 'in_progress', label: 'Взять в работу', icon: Play, success: 'Задача взята в работу' }
    case 'in_progress':
      return { to: 'in_review', label: 'Отправить на проверку', icon: Send, success: 'Задача отправлена на проверку' }
    case 'rework':
      return { to: 'in_progress', label: 'Продолжить работу', icon: RotateCcw, success: 'Работа над задачей продолжена' }
    case 'in_review':
    case 'accepted':
      return null
  }
}

export const ACCEPT_ICON = CheckCheck

/** Human-readable description of a history entry. */
export function transitionLabel(from: TaskStatus | null, to: TaskStatus): string {
  if (from === null) return 'Задача создана'
  if (to === 'in_progress') return from === 'rework' ? 'Работа возобновлена' : 'Взята в работу'
  if (to === 'in_review') return 'Отправлена на проверку'
  if (to === 'accepted') return 'Задача принята'
  if (to === 'rework') return 'Возвращена на доработку'
  return STATUS_META[to].label
}

export const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
}

export function countByStatus(tasks: readonly { status: TaskStatus }[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { new: 0, in_progress: 0, in_review: 0, rework: 0, accepted: 0 }
  for (const t of tasks) counts[t.status]++
  return counts
}
