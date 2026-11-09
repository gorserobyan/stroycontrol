export const queryKeys = {
  sites: ['sites'] as const,
  site: (id: string) => ['sites', id] as const,
  tasks: ['tasks'] as const,
  taskList: (siteId: string | null) => ['tasks', 'list', siteId ?? 'all'] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
  history: (taskId: string) => ['history', taskId] as const,
  executors: ['executors'] as const,
}
