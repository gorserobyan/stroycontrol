import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Site, SiteSummary } from '@/lib/types'
import { queryKeys } from './keys'

/** Sites with their visible tasks. For executors, RLS limits both the sites and the embedded tasks. */
export function useSites() {
  return useQuery({
    queryKey: queryKeys.sites,
    queryFn: async (): Promise<SiteSummary[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, address, created_at, tasks(id, status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSite(id: string) {
  return useQuery({
    queryKey: queryKeys.site(id),
    queryFn: async (): Promise<Site | null> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, address, created_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export interface SiteInput {
  name: string
  address: string
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SiteInput): Promise<Site> => {
      const { data, error } = await supabase
        .from('sites')
        .insert({ name: input.name, address: input.address })
        .select('id, name, address, created_at')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sites }),
  })
}

export function useUpdateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: SiteInput & { id: string }): Promise<Site> => {
      const { data, error } = await supabase
        .from('sites')
        .update({ name: input.name, address: input.address })
        .eq('id', id)
        .select('id, name, address, created_at')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.sites }),
        qc.invalidateQueries({ queryKey: queryKeys.tasks }),
      ])
    },
  })
}

/** Soft-deletes the site and its active tasks. Returns the number of archived tasks. */
export function useArchiveSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<number> => {
      const { data, error } = await supabase.rpc('archive_site', { p_site_id: id })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.sites }),
        qc.invalidateQueries({ queryKey: queryKeys.tasks }),
      ])
    },
  })
}
