-- =============================================================================
-- СтройКонтроль — 03. Workflow RPC functions (the only write paths for status
-- and archiving)
-- =============================================================================
-- These functions are SECURITY DEFINER because they must write columns that
-- API roles have no privilege on (tasks.status, archived_*) and insert into the
-- history table. They are deliberately narrow: each one does a single,
-- fully-validated operation on a single row (or a site and its tasks).
-- EXECUTE is granted to `authenticated` only (migration 05).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- transition_task_status
-- -----------------------------------------------------------------------------
create or replace function public.transition_task_status(
  p_task_id   uuid,
  p_to_status public.task_status,
  p_comment   text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          public.user_role;
  v_task          public.tasks;
  v_required_role public.user_role;
  v_from_status   public.task_status;
  v_comment       text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  -- 1. Identity comes only from the verified JWT.
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Требуется авторизация';
  end if;

  -- 2. Trusted role from the database, never from the client.
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is null then
    raise exception using errcode = '42501', message = 'Профиль пользователя не найден. Обратитесь к администратору';
  end if;

  if p_task_id is null or p_to_status is null then
    raise exception using errcode = '22023', message = 'Не указана задача или новый статус';
  end if;

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception using errcode = '22023', message = 'Комментарий не должен превышать 2000 символов';
  end if;

  -- 3. Lock the row BEFORE reading its status: concurrent transitions,
  --    reassignments and archiving are serialised on this lock.
  select * into v_task
  from public.tasks t
  where t.id = p_task_id
  for update;

  -- Executors get the same answer for "does not exist" and "not yours", so the
  -- function cannot be used to probe other executors' task ids.
  if not found
     or v_task.archived_at is not null
     or (v_role = 'executor' and v_task.assignee_id is distinct from v_uid) then
    raise exception using errcode = 'P0002', message = 'Задача не найдена или у вас нет к ней доступа';
  end if;

  -- 5. The transition table (single source of truth, mirrored by the
  --    history_valid_transition CHECK constraint).
  v_required_role := case
    when v_task.status = 'new'         and p_to_status = 'in_progress' then 'executor'
    when v_task.status = 'in_progress' and p_to_status = 'in_review'   then 'executor'
    when v_task.status = 'rework'      and p_to_status = 'in_progress' then 'executor'
    when v_task.status = 'in_review'   and p_to_status = 'accepted'    then 'manager'
    when v_task.status = 'in_review'   and p_to_status = 'rework'      then 'manager'
    else null
  end::public.user_role;

  if v_required_role is null then
    raise exception using errcode = '22023',
      message = format('Переход из статуса «%s» в статус «%s» запрещён',
                       private.status_label(v_task.status), private.status_label(p_to_status));
  end if;

  -- 4 & 6. Role and current-assignee checks.
  if v_required_role = 'executor' then
    if v_role <> 'executor' or v_task.assignee_id <> v_uid then
      raise exception using errcode = '42501', message = 'Это действие может выполнить только назначенный исполнитель';
    end if;
  elsif v_role <> 'manager' then
    raise exception using errcode = '42501', message = 'Это действие доступно только постановщику';
  end if;

  -- 7. Rework requires a reason.
  if p_to_status = 'rework' and v_comment is null then
    raise exception using errcode = '22023', message = 'Укажите комментарий: что нужно доработать';
  end if;

  -- 8. Update status (the trigger only allows it while this flag is on).
  v_from_status := v_task.status;
  perform set_config('stroycontrol.workflow_write', 'on', true);
  update public.tasks
     set status = p_to_status
   where id = v_task.id
  returning * into v_task;
  perform set_config('stroycontrol.workflow_write', '', true);

  -- 9. Exactly one history entry per successful transition.
  insert into public.task_status_history (task_id, actor_id, from_status, to_status, comment)
  values (v_task.id, v_uid, v_from_status, p_to_status, v_comment);

  -- 10. Atomicity: the whole function body runs in the caller's transaction;
  --     any exception above rolls back both the UPDATE and the INSERT.
  return v_task;
end
$$;

comment on function public.transition_task_status(uuid, public.task_status, text) is
  'The only way to change tasks.status. Validates actor, role, assignee and transition; writes exactly one history row.';

-- -----------------------------------------------------------------------------
-- archive_task — soft delete a single task (manager only)
-- -----------------------------------------------------------------------------
create or replace function public.archive_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_task public.tasks;
begin
  if v_uid is null or not private.is_manager() then
    raise exception using errcode = '42501', message = 'Удалять задачи может только постановщик';
  end if;

  select * into v_task from public.tasks t where t.id = p_task_id for update;
  if not found or v_task.archived_at is not null then
    raise exception using errcode = 'P0002', message = 'Задача не найдена';
  end if;

  perform set_config('stroycontrol.workflow_write', 'on', true);
  update public.tasks
     set archived_at = now(), archived_by = v_uid
   where id = v_task.id;
  perform set_config('stroycontrol.workflow_write', '', true);
end
$$;

comment on function public.archive_task(uuid) is
  'Soft-deletes a task (manager only). History is preserved; the task disappears from API reads and can no longer transition.';

-- -----------------------------------------------------------------------------
-- archive_site — soft delete a site together with all of its active tasks
-- -----------------------------------------------------------------------------
create or replace function public.archive_site(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_archived integer;
begin
  if v_uid is null or not private.is_manager() then
    raise exception using errcode = '42501', message = 'Удалять объекты может только постановщик';
  end if;

  -- FOR UPDATE conflicts with the FOR SHARE taken when a task is created on /
  -- moved to this site, so no new task can slip in while we archive.
  perform 1 from public.sites s
   where s.id = p_site_id and s.archived_at is null
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Объект не найден';
  end if;

  perform set_config('stroycontrol.workflow_write', 'on', true);

  -- Lock tasks in a stable order to avoid deadlocks with concurrent transitions.
  perform 1 from public.tasks t
   where t.site_id = p_site_id and t.archived_at is null
   order by t.id
   for update;

  update public.tasks
     set archived_at = now(), archived_by = v_uid
   where site_id = p_site_id and archived_at is null;
  get diagnostics v_archived = row_count;

  update public.sites
     set archived_at = now(), archived_by = v_uid
   where id = p_site_id;

  perform set_config('stroycontrol.workflow_write', '', true);
  return v_archived;
end
$$;

comment on function public.archive_site(uuid) is
  'Soft-deletes a site and all of its active tasks atomically (manager only). Returns the number of tasks archived.';
