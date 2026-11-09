-- =============================================================================
-- СтройКонтроль — 05. Privileges (least privilege for API roles)
-- =============================================================================
-- Supabase grants ALL on new public tables/functions to anon & authenticated by
-- default. We revoke everything and grant back only what is needed. RLS decides
-- WHICH rows; these grants decide WHICH operations and WHICH columns.
--
-- Key point (task 9.3): managers can UPDATE tasks directly, but only the
-- columns title/description/site_id/assignee_id. status, created_by,
-- created_at, updated_at, archived_* are not grantable, so a direct
-- PATCH /tasks?status=... fails with "permission denied" for every API user.
-- =============================================================================

-- Tables ----------------------------------------------------------------------
revoke all on table
  public.profiles, public.sites, public.tasks, public.task_status_history
from public, anon, authenticated;

grant select on table
  public.profiles, public.sites, public.tasks, public.task_status_history
to authenticated;

grant insert (name, address)        on public.sites to authenticated;
grant update (name, address)        on public.sites to authenticated;

grant insert (title, description, site_id, assignee_id) on public.tasks to authenticated;
grant update (title, description, site_id, assignee_id) on public.tasks to authenticated;

-- No INSERT/UPDATE/DELETE on profiles or task_status_history for API roles.
-- No DELETE on sites or tasks for API roles (soft delete via RPC only).

-- service_role (server-side admin key, never shipped to the browser) keeps full
-- access for provisioning users/profiles.
grant all on table
  public.profiles, public.sites, public.tasks, public.task_status_history
to service_role;

-- Types -------------------------------------------------------------------------
grant usage on type public.user_role, public.task_status to authenticated, service_role;

-- Private schema ----------------------------------------------------------------
-- RLS policies run as the querying role, so `authenticated` needs to execute
-- the three read-only helpers. The schema is not exposed by the Data API, so
-- they cannot be invoked over HTTP.
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function
  private.current_user_role(),
  private.is_manager(),
  private.executor_can_see_profile(uuid)
to authenticated, service_role;

-- RPC functions ------------------------------------------------------------------
revoke all on function public.transition_task_status(uuid, public.task_status, text) from public, anon;
revoke all on function public.archive_task(uuid)                                    from public, anon;
revoke all on function public.archive_site(uuid)                                    from public, anon;

grant execute on function public.transition_task_status(uuid, public.task_status, text) to authenticated;
grant execute on function public.archive_task(uuid)                                    to authenticated;
grant execute on function public.archive_site(uuid)                                    to authenticated;

-- Future objects ------------------------------------------------------------------
-- Objects created by later migrations must opt in to API exposure explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
