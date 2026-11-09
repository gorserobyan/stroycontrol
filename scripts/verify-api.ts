/**
 * СтройКонтроль — API-level security smoke test.
 *
 * Bypasses the React app entirely and attacks the Supabase Data API with only
 * the PUBLIC key, as a real attacker would. Requires seeded demo data.
 *
 *   DEMO_PASSWORD='...' npm run verify:local
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'

type Client = SupabaseClient<Database>

const url = process.env.SUPABASE_URL ?? ''
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const password = process.env.DEMO_PASSWORD ?? ''
if (!url || !key || !password) {
  console.error('✖ Нужны SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY и DEMO_PASSWORD')
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const
let failures = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? '  ✔' : '  ✖'} ${name}${!ok && detail ? ` — ${detail}` : ''}`)
}

async function login(email: string): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(url, key, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`)
  return { client, id: data.user.id }
}

async function main(): Promise<void> {
  const anon = createClient<Database>(url, key, opts)
  const petrov = await login('petrov@stroycontrol.test')
  const kozlov = await login('kozlov@stroycontrol.test')
  const manager = await login('manager@stroycontrol.test')

  console.log('▸ Аноним')
  {
    const sites = await anon.from('sites').select('id')
    check('аноним не читает объекты', sites.error !== null || (sites.data?.length ?? 0) === 0)
    const tasks = await anon.from('tasks').select('id')
    check('аноним не читает задачи', tasks.error !== null || (tasks.data?.length ?? 0) === 0)
  }

  console.log('▸ Исполнитель (Петров)')
  const { data: own } = await petrov.client.from('tasks').select('id, assignee_id, status, title')
  check('видит только свои задачи', (own ?? []).length > 0 && (own ?? []).every((t) => t.assignee_id === petrov.id))

  const { data: kozlovTasks } = await kozlov.client.from('tasks').select('id, status')
  const foreign = kozlovTasks?.[0]
  if (!foreign) throw new Error('no kozlov tasks — seed first')

  const foreignRead = await petrov.client.from('tasks').select('id').eq('id', foreign.id)
  check('не читает чужую задачу по id', (foreignRead.data ?? []).length === 0)

  const foreignHistory = await petrov.client.from('task_status_history').select('id').eq('task_id', foreign.id)
  check('не читает историю чужой задачи', (foreignHistory.data ?? []).length === 0)

  const embedded = await petrov.client.from('sites').select('id, tasks(id, assignee_id)')
  const leaked = (embedded.data ?? []).flatMap((s) => s.tasks).filter((t) => t.assignee_id !== petrov.id)
  check('встраивание sites→tasks не раскрывает чужие задачи', embedded.error === null && leaked.length === 0)

  const target = own?.[0]
  if (!target) throw new Error('no own tasks')
  const statusPatch = await petrov.client.from('tasks').update({ title: target.title }).eq('id', target.id).select('id')
  check('не может редактировать свою задачу', (statusPatch.data ?? []).length === 0)

  // Bypass the typed client to send a forbidden column.
  const raw = await fetch(`${url}/rest/v1/tasks?id=eq.${target.id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${(await petrov.client.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'accepted' }),
  })
  check('прямой PATCH status запрещён', raw.status === 401 || raw.status === 403, `HTTP ${raw.status}`)

  const role = await petrov.client.from('profiles').update({ role: 'manager' }).eq('id', petrov.id).select('id')
  check('не может повысить себя до постановщика', role.error !== null)

  const history = await petrov.client.from('task_status_history').insert({
    task_id: target.id,
    actor_id: manager.id,
    from_status: 'in_review',
    to_status: 'accepted',
  })
  check('не может подделать историю', history.error !== null)

  const site = await petrov.client.from('sites').insert({ name: 'Взлом', address: 'нет' })
  check('не может создать объект', site.error !== null)

  const rpc = await petrov.client.rpc('transition_task_status', { p_task_id: foreign.id, p_to_status: 'in_progress' })
  check('не может менять статус чужой задачи', rpc.error !== null)

  const archive = await petrov.client.rpc('archive_task', { p_task_id: target.id })
  check('не может удалить задачу', archive.error !== null)

  console.log('▸ Постановщик')
  const managerStatus = await fetch(`${url}/rest/v1/tasks?id=eq.${target.id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${(await manager.client.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'accepted' }),
  })
  check('даже постановщик не меняет status напрямую', managerStatus.status === 401 || managerStatus.status === 403, `HTTP ${managerStatus.status}`)

  const del = await manager.client.from('tasks').delete().eq('id', target.id).select('id')
  check('жёсткое удаление недоступно', del.error !== null || (del.data ?? []).length === 0)

  console.log(failures === 0 ? '\n✔ Все проверки пройдены' : `\n✖ Провалено проверок: ${failures}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e: unknown) => {
  console.error('✖', e instanceof Error ? e.message : e)
  process.exit(1)
})
