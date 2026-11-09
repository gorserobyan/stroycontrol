-- =============================================================================
-- СтройКонтроль — 04. Row Level Security
-- =============================================================================
-- Rules
--  * RLS is enabled (and FORCED) on every application table.
--  * Policies target `authenticated` only; `anon` has no policy and no grants.
--  * Archived rows are invisible to every API user, managers included.
--  * Role checks go through private.* SECURITY DEFINER helpers that read
--    `profiles` directly, so no policy ever re-enters another table's policy
--    in a cycle (sites → tasks is one-way; tasks never looks at sites).
--  * `(select …)` wrappers let Postgres evaluate auth.uid()/role once per
--    statement (initPlan) instead of once per row.
--  * There are NO delete policies: hard deletes are impossible via the API.
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.sites                enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_status_history  enable row level security;

alter table public.profiles             force row level security;
alter table public.sites                force row level security;
alter table public.tasks                force row level security;
alter table public.task_status_history  force row level security;

-- -----------------------------------------------------------------------------
-- profiles — read-only for API users. Nobody can insert/update/delete profiles
-- through the API (no policies + no grants), so no one can change a role.
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_manager())
    or private.executor_can_see_profile(id)
  );

-- -----------------------------------------------------------------------------
-- sites
-- -----------------------------------------------------------------------------
create policy sites_select on public.sites
  for select to authenticated
  using (
    archived_at is null
    and (
      (select private.is_manager())
      or exists (
        select 1
        from public.tasks t
        where t.site_id = sites.id
          and t.assignee_id = (select auth.uid())
          and t.archived_at is null
      )
    )
  );

create policy sites_insert_manager on public.sites
  for insert to authenticated
  with check ((select private.is_manager()));

create policy sites_update_manager on public.sites
  for update to authenticated
  using (archived_at is null and (select private.is_manager()))
  with check (archived_at is null and (select private.is_manager()));

-- -----------------------------------------------------------------------------
-- tasks — executors: only rows where they are the CURRENT assignee.
-- Reassignment therefore revokes the previous executor's access immediately.
-- -----------------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    archived_at is null
    and (
      (select private.is_manager())
      or assignee_id = (select auth.uid())
    )
  );

create policy tasks_insert_manager on public.tasks
  for insert to authenticated
  with check ((select private.is_manager()));

create policy tasks_update_manager on public.tasks
  for update to authenticated
  using (archived_at is null and (select private.is_manager()))
  with check (archived_at is null and (select private.is_manager()));

-- -----------------------------------------------------------------------------
-- task_status_history — read-only; visibility follows the task's CURRENT
-- assignee (documented decision). No insert/update/delete policies at all.
-- -----------------------------------------------------------------------------
create policy history_select on public.task_status_history
  for select to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_status_history.task_id
        and t.archived_at is null
        and (
          (select private.is_manager())
          or t.assignee_id = (select auth.uid())
        )
    )
  );
