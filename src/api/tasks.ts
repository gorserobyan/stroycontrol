import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { HistoryEntry, PersonRef, Task, TaskStatus } from '@/lib/types'
import { queryKeys } from './keys'

// Explicit FK hints: tasks has several FKs to profiles (assignee, author, archived_by).
const TASK_SELECT = `
  id, title, description, status, created_at, updated_at, site_id, assignee_id, created_by,
  site:sites!tasks_site_id_fkey(id, name, address),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  author:profiles!tasks_created_by_fkey(id, full_name)
` as const

/** All tasks visible to the user (RLS: managers → all, executors → own), optionally for one site. */
export function useTasks(siteId: string | null = null) {
  return useQuery({
    queryKey: queryKeys.taskList(siteId),
    queryFn: async (): Promise<Task[]> => {
      let query = supabase.from('tasks').select(TASK_SELECT).order('created_at', { ascending: false })
      if (siteId) query = query.eq('site_id', siteId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: queryKeys.task(id),
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useTaskHistory(taskId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.history(taskId),
    enabled,
    queryFn: async (): Promise<HistoryEntry[]> => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('id, from_status, to_status, comment, created_at, actor:profiles!task_status_history_actor_id_fkey(id, full_name, role)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

/** Executors available for assignment (only readable by managers). */
export function useExecutors(enabled = true) {
  return useQuery({
    queryKey: queryKeys.executors,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PersonRef[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'executor')
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

export interface TaskInput {
  title: string
  description: string
  site_id: string
  assignee_id: string
}

function useInvalidateTasks() {
  const qc = useQueryClient()
  return (taskId?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.tasks }),
      qc.invalidateQueries({ queryKey: queryKeys.sites }),
      taskId ? qc.invalidateQueries({ queryKey: queryKeys.history(taskId) }) : Promise.resolve(),
    ])
}

/** status, created_by and created_at are set by the database — never sent from here. */
export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async (input: TaskInput): Promise<{ id: string }> => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          description: input.description,
          site_id: input.site_id,
          assignee_id: input.assignee_id,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(),
  })
}

/** Edits metadata only. The database rejects any attempt to touch status here. */
export function useUpdateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async ({ id, ...input }: TaskInput & { id: string }): Promise<void> => {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: input.title,
          description: input.description,
          site_id: input.site_id,
          assignee_id: input.assignee_id,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => invalidate(vars.id),
  })
}

export function useArchiveTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.rpc('archive_task', { p_task_id: id })
      if (error) throw error
    },
    onSuccess: () => invalidate(),
  })
}

export function useTransitionTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async (vars: { id: string; to: TaskStatus; comment?: string }): Promise<void> => {
      const { error } = await supabase.rpc('transition_task_status', {
        p_task_id: vars.id,
        p_to_status: vars.to,
        ...(vars.comment ? { p_comment: vars.comment } : {}),
      })
      if (error) throw error
    },
    // Refresh on failure too: a stale status is the most common cause.
    onSettled: (_data, _error, vars) => invalidate(vars.id),
  })
}
