-- =============================================================================
-- СтройКонтроль — database security & workflow tests (pgTAP)
-- Run with:  supabase test db
-- Each test impersonates an API user exactly like PostgREST does:
--   SET ROLE authenticated + request.jwt.claims.sub = <user id>
-- Everything runs in one transaction and is rolled back at the end.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(70);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres = trusted admin)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'm@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f0', 'nop@test.local','authenticated', 'authenticated');

insert into public.profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Менеджер', 'manager'),
  ('00000000-0000-0000-0000-0000000000e1', 'Исполнитель 1', 'executor'),
  ('00000000-0000-0000-0000-0000000000e2', 'Исполнитель 2', 'executor');
-- f0 deliberately has NO profile.

-- ===========================================================================
-- Anonymous
-- ===========================================================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select * from public.sites $$, '42501', null, 'anon cannot read sites');
select throws_ok($$ select * from public.tasks $$, '42501', null, 'anon cannot read tasks');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.task_status_history $$, '42501', null, 'anon cannot read history');
select throws_ok($$ select public.transition_task_status(gen_random_uuid(), 'in_progress') $$,
  '42501', null, 'anon cannot execute transition RPC');

-- ===========================================================================
-- Manager: sites and tasks
-- ===========================================================================
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select lives_ok($$
  insert into public.sites (name, address) values
    ('Объект А', 'Адрес А'), ('Объект Б', 'Адрес Б'), ('Объект В', 'Адрес В')
$$, 'manager creates sites');

select throws_ok($$ insert into public.sites (name, address) values ('  объект а ', 'x') $$,
  '23505', null, 'active site names are unique (case/space-insensitive)');

select throws_ok($$ insert into public.sites (name, address, created_at) values ('X', 'Y', '2000-01-01') $$,
  '42501', null, 'manager cannot forge site created_at');

create temporary table ids (k text primary key, id uuid) on commit drop;
grant all on ids to authenticated, anon;
insert into ids select 'siteA', id from public.sites where name = 'Объект А';
insert into ids select 'siteB', id from public.sites where name = 'Объект Б';
insert into ids select 'siteC', id from public.sites where name = 'Объект В';

select lives_ok($$
  insert into public.tasks (title, description, site_id, assignee_id)
  values ('Задача E1', 'описание', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000e1')
$$, 'manager creates task for executor 1');

select lives_ok($$
  insert into public.tasks (title, site_id, assignee_id)
  values ('Задача E2', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000e2')
$$, 'manager creates task for executor 2 on the same site');

select lives_ok($$
  insert into public.tasks (title, site_id, assignee_id)
  values ('Задача E2 на Б', (select id from ids where k='siteB'), '00000000-0000-0000-0000-0000000000e2')
$$, 'manager creates task for executor 2 on site B');

insert into ids select 't1', id from public.tasks where title = 'Задача E1';
insert into ids select 't2', id from public.tasks where title = 'Задача E2';
insert into ids select 't3', id from public.tasks where title = 'Задача E2 на Б';

select results_eq(
  $$ select status::text, created_by from public.tasks where id = (select id from ids where k='t1') $$,
  $$ values ('new', '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'new task: status=new and created_by=current manager');

select results_eq(
  $$ select count(*)::int, min(from_status::text), min(to_status::text)
     from public.task_status_history where task_id = (select id from ids where k='t1') $$,
  $$ values (1, null::text, 'new') $$,
  'task creation writes exactly one history entry (∅ → new)');

select throws_ok($$
  insert into public.tasks (title, site_id, assignee_id, status)
  values ('x', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000e1', 'accepted')
$$, '42501', null, 'manager cannot set status on insert');

select throws_ok($$
  insert into public.tasks (title, site_id, assignee_id, created_by)
  values ('x', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1')
$$, '42501', null, 'manager cannot forge created_by');

select throws_ok($$
  insert into public.tasks (title, site_id, assignee_id)
  values ('x', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000a1')
$$, '23514', null, 'task cannot be assigned to a manager');

select throws_ok($$
  insert into public.tasks (title, site_id, assignee_id)
  values ('x', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000f0')
$$, '23514', null, 'task cannot be assigned to a user without a profile');

select throws_ok($$ update public.tasks set status = 'accepted' where id = (select id from ids where k='t1') $$,
  '42501', null, 'manager cannot update status directly');

select throws_ok($$ update public.tasks set created_by = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'manager cannot change created_by');

select throws_ok($$ delete from public.tasks where id = (select id from ids where k='t1') $$,
  '42501', null, 'nobody can hard-delete tasks');

select throws_ok($$ delete from public.sites where id = (select id from ids where k='siteC') $$,
  '42501', null, 'nobody can hard-delete sites');

select lives_ok($$ update public.tasks set title = 'Задача E1 (ред.)' where id = (select id from ids where k='t1') $$,
  'manager edits task title');

select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_progress') $$,
  '42501', null, 'manager cannot start an executor task');

select throws_ok($$ update public.profiles set role = 'executor' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'manager cannot change roles via the API');

-- ===========================================================================
-- Executor 1: visibility
-- ===========================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select results_eq($$ select count(*)::int from public.tasks $$, $$ values (1) $$,
  'executor 1 sees only own task');
select results_eq($$ select name from public.sites order by name $$, $$ values ('Объект А'::text) $$,
  'executor 1 sees only sites with own tasks');
select results_eq(
  $$ select count(*)::int from public.sites s join public.tasks t on t.site_id = s.id $$,
  $$ values (1) $$, 'joins through a shared site do not leak other executors tasks');
select results_eq(
  $$ select count(*)::int from public.task_status_history $$, $$ values (1) $$,
  'executor 1 sees only own task history');
select results_eq(
  $$ select full_name from public.profiles order by full_name $$,
  $$ values ('Исполнитель 1'::text), ('Менеджер'::text) $$,
  'executor 1 sees self and task author, not other executors');

-- Executor 1: forbidden writes
select throws_ok($$ insert into public.sites (name, address) values ('Хак', 'Хак') $$,
  '42501', null, 'executor cannot create sites');
select is_empty($$ update public.sites set name = 'Хак' returning id $$,
  'executor update on sites affects no rows');
select throws_ok($$
  insert into public.tasks (title, site_id, assignee_id)
  values ('Хак', (select id from ids where k='siteA'), '00000000-0000-0000-0000-0000000000e1')
$$, '42501', null, 'executor cannot create tasks');
select is_empty($$ update public.tasks set title = 'Хак' returning id $$,
  'executor cannot edit task metadata');
select is_empty($$ update public.tasks set assignee_id = '00000000-0000-0000-0000-0000000000e2' returning id $$,
  'executor cannot reassign tasks');
select throws_ok($$ update public.tasks set status = 'accepted' $$,
  '42501', null, 'executor cannot update status directly');
select throws_ok($$ update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'executor cannot promote self');
select throws_ok($$
  insert into public.task_status_history (task_id, actor_id, from_status, to_status)
  values ((select id from ids where k='t1'), '00000000-0000-0000-0000-0000000000a1', 'in_review', 'accepted')
$$, '42501', null, 'executor cannot forge history');
select throws_ok($$ delete from public.task_status_history $$, '42501', null, 'executor cannot delete history');
select throws_ok($$ select public.archive_task((select id from ids where k='t1')) $$,
  '42501', null, 'executor cannot archive tasks');
select throws_ok($$ select public.archive_site((select id from ids where k='siteA')) $$,
  '42501', null, 'executor cannot archive sites');

-- Executor 1: workflow
select throws_ok($$ select public.transition_task_status((select id from ids where k='t2'), 'in_progress') $$,
  'P0002', null, 'executor cannot transition another executors task');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_review') $$,
  '22023', null, 'new → in_review is rejected');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'accepted') $$,
  '22023', null, 'new → accepted is rejected');
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_progress') $$,
  'executor: new → in_progress');
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_review') $$,
  'executor: in_progress → in_review');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'accepted') $$,
  '42501', null, 'executor cannot accept own task');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'rework', 'сам себе') $$,
  '42501', null, 'executor cannot return own task');

-- ===========================================================================
-- Manager: review
-- ===========================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'rework') $$,
  '22023', null, 'rework requires a comment');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'rework', '   ') $$,
  '22023', null, 'rework rejects a whitespace-only comment');
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'rework', 'Переделать щиток') $$,
  'manager: in_review → rework with comment');

select results_eq(
  $$ select from_status::text, to_status::text, actor_id, comment
     from public.task_status_history where task_id = (select id from ids where k='t1')
     order by created_at desc, to_status desc limit 1 $$,
  $$ values ('in_review', 'rework', '00000000-0000-0000-0000-0000000000a1'::uuid, 'Переделать щиток') $$,
  'history row records actor, from, to and comment');

-- Reassignment: E1 → E2, status is preserved.
select lives_ok($$ update public.tasks set assignee_id = '00000000-0000-0000-0000-0000000000e2' where id = (select id from ids where k='t1') $$,
  'manager reassigns task to executor 2');
select results_eq($$ select status::text from public.tasks where id = (select id from ids where k='t1') $$,
  $$ values ('rework') $$, 'reassignment does not change status');

-- Old executor loses access immediately.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is_empty($$ select id from public.tasks $$, 'old executor no longer sees the task');
select is_empty($$ select id from public.task_status_history $$, 'old executor no longer sees its history');
select is_empty($$ select id from public.sites $$, 'old executor no longer sees the site');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_progress') $$,
  'P0002', null, 'old executor can no longer transition the task');

-- New executor can continue the workflow.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_progress') $$,
  'new executor: rework → in_progress');
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'in_review') $$,
  'new executor: in_progress → in_review');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'accepted') $$,
  'manager: in_review → accepted');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t1'), 'rework', 'ещё раз') $$,
  '22023', null, 'accepted is terminal');
select throws_ok($$ update public.tasks set assignee_id = '00000000-0000-0000-0000-0000000000e1' where id = (select id from ids where k='t1') $$,
  '23514', null, 'accepted task cannot be reassigned');

select results_eq(
  $$ select count(*)::int from public.task_status_history where task_id = (select id from ids where k='t1') $$,
  $$ values (7) $$, 'exactly one history row per successful transition (1 + 6)');

-- Archiving
select lives_ok($$ select public.archive_task((select id from ids where k='t2')) $$, 'manager archives a task');
select is_empty($$ select id from public.tasks where id = (select id from ids where k='t2') $$,
  'archived task disappears from API reads');
select throws_ok($$ select public.transition_task_status((select id from ids where k='t2'), 'in_progress') $$,
  'P0002', null, 'archived task cannot transition');
select results_eq($$ select public.archive_site((select id from ids where k='siteB')) $$, $$ values (1) $$,
  'archiving a site archives its active tasks');

-- ===========================================================================
-- User without a profile
-- ===========================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f0","role":"authenticated"}';
select is_empty($$ select id from public.sites union all select id from public.tasks $$,
  'user without a profile sees no data');

-- ===========================================================================
-- Trusted admin: history is immutable and preserved
-- ===========================================================================
reset role;
select results_eq(
  $$ select count(*)::int from public.task_status_history where task_id = (select id from ids where k='t2') $$,
  $$ values (1) $$, 'history of archived task is preserved');
select throws_ok($$ update public.task_status_history set comment = 'x' $$,
  '42501', null, 'history is immutable even for the database owner');

select * from finish();
rollback;
