-- =============================================================================
-- СтройКонтроль — 01. Types, tables, constraints, indexes
-- =============================================================================
-- Design notes
--  * Every table lives in `public` (the schema exposed by the Data API), but no
--    table is writable by API roles except through the narrow column grants in
--    migration 05 and the SECURITY DEFINER functions in migration 03.
--  * Sites and tasks are soft-deleted (`archived_at`). Nothing is ever hard
--    deleted through the API, so `task_status_history` is always preserved.
--  * Foreign keys use ON DELETE RESTRICT everywhere history could be lost.
-- =============================================================================

create type public.user_role as enum ('manager', 'executor');

create type public.task_status as enum (
  'new',          -- Новая
  'in_progress',  -- В работе
  'in_review',    -- На проверке
  'accepted',     -- Принята (terminal)
  'rework'        -- На доработке
);

-- -----------------------------------------------------------------------------
-- profiles: one row per provisioned application user. Created ONLY by trusted
-- administrative setup (service role / SQL), never from signup metadata.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key
              references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null,
  created_at  timestamptz not null default now(),

  constraint profiles_full_name_not_blank
    check (char_length(btrim(full_name)) between 1 and 200)
);

comment on table public.profiles is
  'Application users. Role is the single source of truth for authorization. Provisioned by administrators only.';

-- -----------------------------------------------------------------------------
-- sites (Объекты)
-- -----------------------------------------------------------------------------
create table public.sites (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  address      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  archived_by  uuid references public.profiles (id) on delete restrict,

  constraint sites_name_not_blank
    check (char_length(btrim(name)) between 1 and 200),
  constraint sites_address_not_blank
    check (char_length(btrim(address)) between 1 and 500),
  constraint sites_archive_consistent
    check ((archived_at is null) = (archived_by is null))
);

comment on table public.sites is 'Construction sites (Объекты). Soft-deleted via archived_at.';

-- Two active sites may not share a name (case-insensitive, whitespace-trimmed).
-- Archived sites do not block re-use of the name.
create unique index sites_active_name_key
  on public.sites (lower(btrim(name)))
  where archived_at is null;

create index sites_created_at_idx on public.sites (created_at desc) where archived_at is null;

-- -----------------------------------------------------------------------------
-- tasks (Задачи)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  site_id      uuid not null references public.sites (id) on delete restrict,
  assignee_id  uuid not null references public.profiles (id) on delete restrict,
  status       public.task_status not null default 'new',
  -- Default documents intent; the BEFORE INSERT trigger enforces it.
  created_by   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  archived_by  uuid references public.profiles (id) on delete restrict,

  constraint tasks_title_not_blank
    check (char_length(btrim(title)) between 1 and 300),
  constraint tasks_description_length
    check (char_length(description) <= 5000),
  constraint tasks_archive_consistent
    check ((archived_at is null) = (archived_by is null))
);

comment on table public.tasks is
  'Tasks. status is changed ONLY by public.transition_task_status(); soft-deleted via archived_at.';

create index tasks_assignee_active_idx on public.tasks (assignee_id, created_at desc) where archived_at is null;
create index tasks_site_active_idx     on public.tasks (site_id, created_at desc)     where archived_at is null;
create index tasks_status_active_idx   on public.tasks (status)                       where archived_at is null;
create index tasks_created_at_idx      on public.tasks (created_at desc)              where archived_at is null;
create index tasks_created_by_idx      on public.tasks (created_by);
create index tasks_archived_by_idx     on public.tasks (archived_by) where archived_by is not null;
create index sites_archived_by_idx     on public.sites (archived_by) where archived_by is not null;

-- -----------------------------------------------------------------------------
-- task_status_history: append-only audit log of status transitions.
-- -----------------------------------------------------------------------------
create table public.task_status_history (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete restrict,
  actor_id     uuid not null references public.profiles (id) on delete restrict,
  from_status  public.task_status,          -- NULL only for the creation entry
  to_status    public.task_status not null,
  comment      text,
  created_at   timestamptz not null default now(),

  -- The history table itself encodes the workflow: an illegal transition can
  -- never be recorded, even by a buggy trusted function.
  constraint history_valid_transition check (
       (from_status is null          and to_status = 'new')
    or (from_status = 'new'          and to_status = 'in_progress')
    or (from_status = 'in_progress'  and to_status = 'in_review')
    or (from_status = 'in_review'    and to_status = 'accepted')
    or (from_status = 'in_review'    and to_status = 'rework')
    or (from_status = 'rework'       and to_status = 'in_progress')
  ),
  constraint history_rework_requires_comment check (
    to_status <> 'rework' or char_length(btrim(coalesce(comment, ''))) > 0
  ),
  constraint history_comment_length check (
    comment is null or char_length(comment) between 1 and 2000
  )
);

comment on table public.task_status_history is
  'Immutable status-transition log. Rows are written only by trusted database functions.';

create index history_task_created_idx on public.task_status_history (task_id, created_at);
create index history_actor_idx        on public.task_status_history (actor_id);
