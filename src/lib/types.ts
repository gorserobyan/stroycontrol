import type { Database } from './database.types'

export type TaskStatus = Database['public']['Enums']['task_status']
export type UserRole = Database['public']['Enums']['user_role']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type SiteRow = Database['public']['Tables']['sites']['Row']
export type TaskRow = Database['public']['Tables']['tasks']['Row']

export interface PersonRef {
  id: string
  full_name: string
}

export interface SiteSummary {
  id: string
  name: string
  address: string
  created_at: string
  /** Only the tasks the current user is allowed to see (RLS-filtered). */
  tasks: { id: string; status: TaskStatus }[]
}

export interface Site {
  id: string
  name: string
  address: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  created_at: string
  updated_at: string
  site_id: string
  assignee_id: string
  created_by: string
  site: { id: string; name: string; address: string } | null
  assignee: PersonRef | null
  author: PersonRef | null
}

export interface HistoryEntry {
  id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  actor: (PersonRef & { role: UserRole }) | null
}
