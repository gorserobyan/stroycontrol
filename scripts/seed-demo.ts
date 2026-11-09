/**
 * СтройКонтроль — idempotent demo provisioning.
 *
 * Runs ONLY on a trusted machine (never in the browser):
 *   1. Creates / updates three demo accounts with the service-role key and
 *      provisions their profiles (role assignment is an admin action).
 *   2. Signs in as those users with the PUBLIC key and drives the real
 *      workflow (insert + transition_task_status RPC), so every history row is
 *      written by the same trusted database code the app uses.
 *
 * Re-running is safe: accounts and profiles are upserted, and demo data is
 * created only if none of the demo sites exist yet.
 *
 * Required environment (see .env.seed.example):
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (anon), SUPABASE_SERVICE_ROLE_KEY,
 *   DEMO_PASSWORD (min 8 chars, letters + digits)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'

type Client = SupabaseClient<Database>
type Role = Database['public']['Enums']['user_role']
type Status = Database['public']['Enums']['task_status']

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`✖ Не задана переменная окружения ${name}. См. .env.seed.example`)
    process.exit(1)
  }
  return value
}

const SUPABASE_URL = requireEnv('SUPABASE_URL')
const PUBLIC_KEY = requireEnv('SUPABASE_PUBLISHABLE_KEY')
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const DEMO_PASSWORD = requireEnv('DEMO_PASSWORD')

if (DEMO_PASSWORD.length < 8 || !/[a-zA-Z]/.test(DEMO_PASSWORD) || !/\d/.test(DEMO_PASSWORD)) {
  console.error('✖ DEMO_PASSWORD должен содержать не менее 8 символов, буквы и цифры')
  process.exit(1)
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

const admin: Client = createClient<Database>(SUPABASE_URL, SERVICE_KEY, clientOptions)

interface DemoUser {
  key: 'manager' | 'petrov' | 'kozlov'
  email: string
  fullName: string
  role: Role
}

const USERS: DemoUser[] = [
  { key: 'manager', email: 'manager@stroycontrol.test', fullName: 'Анна Соколова', role: 'manager' },
  { key: 'petrov', email: 'petrov@stroycontrol.test', fullName: 'Иван Петров', role: 'executor' },
  { key: 'kozlov', email: 'kozlov@stroycontrol.test', fullName: 'Дмитрий Козлов', role: 'executor' },
]

const SITES = [
  { key: 'north', name: 'ЖК Северный квартал', address: 'Москва, ул. Лесная, 14' },
  { key: 'horizon', name: 'Бизнес-центр Горизонт', address: 'Москва, Ленинградский проспект, 38' },
  { key: 'river', name: 'ЖК Речной парк', address: 'Москва, ул. Набережная, 7' },
] as const

type SiteKey = (typeof SITES)[number]['key']
type Actor = DemoUser['key']

/** A workflow step: who performs it, target status, optional comment. */
type Step = [Actor, Status, string?]

interface DemoTask {
  title: string
  description: string
  site: SiteKey
  assignee: 'petrov' | 'kozlov'
  steps: Step[]
}

const TASKS: DemoTask[] = [
  {
    title: 'Проверить электропроводку на 3 этаже',
    description: 'Проверить сопротивление изоляции, маркировку линий и затяжку клемм в щитках ЩЭ-3.1 и ЩЭ-3.2. Приложить протокол замеров.',
    site: 'north',
    assignee: 'petrov',
    steps: [
      ['petrov', 'in_progress'],
      ['petrov', 'in_review'],
      ['manager', 'accepted'],
    ],
  },
  {
    title: 'Завершить монтаж вентиляции',
    description: 'Смонтировать оставшиеся воздуховоды в секции 2, установить решётки и провести пусконаладку приточной установки П1.',
    site: 'north',
    assignee: 'kozlov',
    steps: [['kozlov', 'in_progress']],
  },
  {
    title: 'Устранить замечания по сантехнике',
    description: 'Устранить замечания технадзора: подтёки на стояках в кв. 41–48, отсутствие ревизионных люков в санузлах.',
    site: 'north',
    assignee: 'petrov',
    steps: [
      ['petrov', 'in_progress'],
      ['petrov', 'in_review'],
      ['manager', 'rework', 'В кв. 46 подтёк на стояке ХВС сохраняется. Заменить муфту и приложить фото.'],
    ],
  },
  {
    title: 'Подготовить фотоотчёт по фасаду',
    description: 'Сделать фотофиксацию всех четырёх сторон фасада после монтажа подсистемы. Отметить участки с отклонением от проекта.',
    site: 'horizon',
    assignee: 'kozlov',
    steps: [
      ['kozlov', 'in_progress'],
      ['kozlov', 'in_review'],
    ],
  },
  {
    title: 'Проверить качество бетонных работ',
    description: 'Провести контроль прочности бетона перекрытия 5 этажа методом отрыва со скалыванием, не менее 6 точек.',
    site: 'horizon',
    assignee: 'petrov',
    steps: [],
  },
  {
    title: 'Смонтировать пожарную сигнализацию в паркинге',
    description: 'Установить извещатели и прокладку шлейфов в подземном паркинге согласно разделу АПС.',
    site: 'horizon',
    assignee: 'kozlov',
    steps: [],
  },
  {
    title: 'Подготовить объект к финальной проверке',
    description: 'Убрать строительный мусор, демонтировать временные ограждения, подготовить исполнительную документацию для комиссии.',
    site: 'river',
    assignee: 'petrov',
    steps: [
      ['petrov', 'in_progress'],
      ['petrov', 'in_review'],
      ['manager', 'rework', 'Не хватает актов скрытых работ по кровле. Дополнить комплект документации.'],
      ['petrov', 'in_progress'],
    ],
  },
  {
    title: 'Проверить гидроизоляцию кровли',
    description: 'Провести пролив кровли секции 1 в течение 24 часов, зафиксировать отсутствие протечек.',
    site: 'river',
    assignee: 'kozlov',
    steps: [
      ['kozlov', 'in_progress'],
      ['kozlov', 'in_review'],
      ['manager', 'accepted'],
    ],
  },
]

function fail(context: string, error: { message: string } | null): never {
  console.error(`✖ ${context}: ${error?.message ?? 'неизвестная ошибка'}`)
  process.exit(1)
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  // Demo-sized project: a few pages are enough.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail('Не удалось получить список пользователей', error)
    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) return match.id
    if (data.users.length < 200) return null
  }
  return null
}

async function provisionUser(user: DemoUser): Promise<string> {
  let id = await findUserIdByEmail(user.email)
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, email_confirm: true })
    if (error) fail(`Не удалось обновить пароль ${user.email}`, error)
    console.log(`  • ${user.email} — уже существует, пароль обновлён`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error || !data.user) fail(`Не удалось создать ${user.email}`, error)
    id = data.user.id
    console.log(`  • ${user.email} — создан`)
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id, full_name: user.fullName, role: user.role }, { onConflict: 'id' })
  if (profileError) fail(`Не удалось создать профиль ${user.email}`, profileError)
  return id
}

async function signIn(email: string): Promise<Client> {
  const client = createClient<Database>(SUPABASE_URL, PUBLIC_KEY, clientOptions)
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  if (error) fail(`Не удалось войти как ${email}`, error)
  return client
}

async function main(): Promise<void> {
  console.log('▸ Учётные записи и профили')
  const ids = new Map<Actor, string>()
  for (const user of USERS) ids.set(user.key, await provisionUser(user))

  const { data: existing, error: existingError } = await admin
    .from('sites')
    .select('id')
    .in('name', SITES.map((s) => s.name))
    .is('archived_at', null)
  if (existingError) fail('Не удалось проверить существующие объекты', existingError)
  if (existing.length > 0) {
    console.log('▸ Демо-объекты уже существуют — данные не пересоздаются.')
    return
  }

  const sessions = new Map<Actor, Client>()
  for (const user of USERS) sessions.set(user.key, await signIn(user.email))
  const as = (actor: Actor): Client => {
    const client = sessions.get(actor)
    if (!client) throw new Error(`Нет сессии для ${actor}`)
    return client
  }

  console.log('▸ Объекты')
  const siteIds = new Map<SiteKey, string>()
  for (const site of SITES) {
    const { data, error } = await as('manager')
      .from('sites')
      .insert({ name: site.name, address: site.address })
      .select('id')
      .single()
    if (error) fail(`Не удалось создать объект «${site.name}»`, error)
    siteIds.set(site.key, data.id)
    console.log(`  • ${site.name}`)
  }

  console.log('▸ Задачи и история статусов')
  for (const task of TASKS) {
    const siteId = siteIds.get(task.site)
    const assigneeId = ids.get(task.assignee)
    if (!siteId || !assigneeId) throw new Error('Некорректные демо-данные')

    const { data, error } = await as('manager')
      .from('tasks')
      .insert({ title: task.title, description: task.description, site_id: siteId, assignee_id: assigneeId })
      .select('id')
      .single()
    if (error) fail(`Не удалось создать задачу «${task.title}»`, error)

    for (const [actor, status, comment] of task.steps) {
      const { error: rpcError } = await as(actor).rpc('transition_task_status', {
        p_task_id: data.id,
        p_to_status: status,
        ...(comment ? { p_comment: comment } : {}),
      })
      if (rpcError) fail(`Переход «${task.title}» → ${status}`, rpcError)
    }
    const finalStatus = task.steps.at(-1)?.[1] ?? 'new'
    console.log(`  • ${task.title} — ${finalStatus}`)
  }

  for (const client of sessions.values()) await client.auth.signOut()
  console.log('✔ Демо-данные созданы')
}

main().catch((error: unknown) => {
  console.error('✖', error instanceof Error ? error.message : error)
  process.exit(1)
})
