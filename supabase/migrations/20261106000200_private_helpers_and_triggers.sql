-- =============================================================================
-- СтройКонтроль — 02. Private helper functions and integrity triggers
-- =============================================================================
-- The `private` schema is NOT exposed through the Supabase Data API, so nothing
-- here can be called over HTTP. API roles get USAGE plus EXECUTE only on the
-- three read-only helpers that RLS policies need (granted in migration 05).
--
-- Every SECURITY DEFINER function:
--   * pins `search_path = ''` and schema-qualifies every object;
--   * derives identity exclusively from auth.uid() (the verified JWT `sub`);
--   * never accepts a user id or a role from the caller.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Identity helpers (used by RLS). SECURITY DEFINER so they can read `profiles`
-- without triggering profiles' own RLS — this is what keeps policies from
-- becoming recursive.
-- -----------------------------------------------------------------------------
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'manager'::public.user_role, false)
$$;

-- An executor may see a colleague's profile (name only matters) when that
-- person authored, or acted in the history of, a task currently assigned to
-- the executor. This lets the timeline show names without exposing the whole
-- staff directory.
create or replace function private.executor_can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.assignee_id = auth.uid()
      and t.archived_at is null
      and (
        t.created_by = p_profile_id
        or exists (
          select 1
          from public.task_status_history h
          where h.task_id = t.id
            and h.actor_id = p_profile_id
        )
      )
  )
$$;

create or replace function private.status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'in_review'   then 'На проверке'
    when 'accepted'    then 'Принята'
    when 'rework'      then 'На доработке'
  end
$$;

-- Trusted functions flip this transaction-local flag around the single
-- UPDATE that is allowed to change workflow columns (status / archived_*).
-- Defense in depth: API roles already lack column privileges on those
-- columns, and cannot call set_config() over the Data API.
create or replace function private.workflow_write_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('stroycontrol.workflow_write', true), '') = 'on'
$$;

-- -----------------------------------------------------------------------------
-- profiles triggers
-- -----------------------------------------------------------------------------
create or replace function private.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'Нельзя изменить идентификатор или дату создания профиля';
  end if;

  -- An executor with active tasks cannot silently become a manager: tasks may
  -- only be assigned to executors.
  if old.role = 'executor' and new.role <> 'executor' and exists (
    select 1 from public.tasks t
    where t.assignee_id = old.id and t.archived_at is null
  ) then
    raise exception using errcode = '23514',
      message = 'Нельзя сменить роль исполнителя, пока у него есть активные задачи';
  end if;

  return new;
end
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function private.profiles_before_update();

-- -----------------------------------------------------------------------------
-- sites triggers
-- -----------------------------------------------------------------------------
create or replace function private.sites_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name        := btrim(new.name);
  new.address     := btrim(new.address);
  new.created_at  := now();
  new.updated_at  := now();
  new.archived_at := null;
  new.archived_by := null;
  return new;
end
$$;

create trigger sites_before_insert
  before insert on public.sites
  for each row execute function private.sites_before_insert();

create or replace function private.sites_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'Нельзя изменить идентификатор или дату создания объекта';
  end if;

  if old.archived_at is not null then
    raise exception using errcode = 'P0002', message = 'Объект находится в архиве';
  end if;

  if (new.archived_at is distinct from old.archived_at or new.archived_by is distinct from old.archived_by)
     and not private.workflow_write_allowed() then
    raise exception using errcode = '42501', message = 'Архивирование выполняется только через archive_site()';
  end if;

  new.name       := btrim(new.name);
  new.address    := btrim(new.address);
  new.updated_at := now();
  return new;
end
$$;

create trigger sites_before_update
  before update on public.sites
  for each row execute function private.sites_before_update();

-- -----------------------------------------------------------------------------
-- tasks triggers
-- -----------------------------------------------------------------------------

-- Shared validation for site / assignee references. SECURITY DEFINER so the
-- checks see the real rows regardless of the caller's RLS visibility.
create or replace function private.assert_task_refs(p_site_id uuid, p_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_archived timestamptz;
  v_site_found    boolean;
  v_role          public.user_role;
begin
  -- FOR SHARE serialises against archive_site(), which takes FOR UPDATE.
  select true, s.archived_at into v_site_found, v_site_archived
  from public.sites s
  where s.id = p_site_id
  for share;

  if not coalesce(v_site_found, false) or v_site_archived is not null then
    raise exception using errcode = '23503', message = 'Выбранный объект не найден или находится в архиве';
  end if;

  -- FOR SHARE serialises against a concurrent role change.
  select p.role into v_role
  from public.profiles p
  where p.id = p_assignee_id
  for share;

  if v_role is distinct from 'executor'::public.user_role then
    raise exception using errcode = '23514', message = 'Исполнителем может быть только пользователь с ролью «Исполнитель»';
  end if;
end
$$;

create or replace function private.tasks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_role public.user_role;
begin
  -- Server-controlled columns: never trusted from the client.
  new.status      := 'new';
  new.created_at  := now();
  new.updated_at  := now();
  new.archived_at := null;
  new.archived_by := null;
  new.title       := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));

  -- Over the Data API auth.uid() is always set (the column is not even
  -- insertable by API roles). It is NULL only for trusted server-side
  -- sessions (postgres / service_role), which may supply created_by.
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  select p.role into v_creator_role from public.profiles p where p.id = new.created_by;
  if v_creator_role is distinct from 'manager'::public.user_role then
    raise exception using errcode = '42501', message = 'Создавать задачи может только постановщик';
  end if;

  perform private.assert_task_refs(new.site_id, new.assignee_id);
  return new;
end
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function private.tasks_before_insert();

create or replace function private.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The "creation → new" transition is recorded like any other.
  insert into public.task_status_history (task_id, actor_id, from_status, to_status, comment)
  values (new.id, new.created_by, null, 'new', null);
  return null;
end
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

create or replace function private.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'Нельзя изменить автора, идентификатор или дату создания задачи';
  end if;

  if old.archived_at is not null then
    raise exception using errcode = 'P0002', message = 'Задача находится в архиве и не может быть изменена';
  end if;

  if (new.status is distinct from old.status
      or new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by)
     and not private.workflow_write_allowed() then
    raise exception using errcode = '42501',
      message = 'Статус задачи меняется только через рабочий процесс (transition_task_status)';
  end if;

  -- Consistency rule (documented): an accepted task is a closed record of who
  -- did the work and where; it cannot be moved or reassigned.
  if old.status = 'accepted'
     and (new.site_id is distinct from old.site_id or new.assignee_id is distinct from old.assignee_id) then
    raise exception using errcode = '23514',
      message = 'Принятую задачу нельзя переназначить или перенести на другой объект';
  end if;

  if new.site_id is distinct from old.site_id or new.assignee_id is distinct from old.assignee_id then
    perform private.assert_task_refs(new.site_id, new.assignee_id);
  end if;

  new.title       := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));
  new.updated_at  := now();
  return new;
end
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function private.tasks_before_update();

-- -----------------------------------------------------------------------------
-- task_status_history: append-only, enforced even for trusted code paths.
-- -----------------------------------------------------------------------------
create or replace function private.history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'История статусов неизменяема';
end
$$;

create trigger history_no_update_delete
  before update or delete on public.task_status_history
  for each row execute function private.history_immutable();

create trigger history_no_truncate
  before truncate on public.task_status_history
  for each statement execute function private.history_immutable();

-- Hard deletes of tasks/sites are never exposed (no DELETE grants), and FKs are
-- RESTRICT, so history can never be orphaned.
