begin;

-- Existing names/statuses are retained so the verify/join RPCs stay compatible.
grant select on public.workshop_sessions to authenticated;
grant insert (title, organization_name, session_code, max_capacity, expires_at, created_by)
  on public.workshop_sessions to authenticated;
grant update (status) on public.workshop_sessions to authenticated;

create policy instructor_sessions_read on public.workshop_sessions
  for select to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'instructor')
  );
create policy instructor_sessions_create on public.workshop_sessions
  for insert to authenticated with check (
    created_by = (select auth.uid()) and status = 'ACTIVE'
    and expires_at > now() and expires_at <= now() + interval '7 days'
    and session_code ~ '^[A-HJ-NP-Z2-9]{6}$'
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'instructor')
  );
create policy instructor_sessions_update on public.workshop_sessions
  for update to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'instructor')
  ) with check (
    created_by = (select auth.uid())
    and (status = 'COMPLETED' or (status = 'ACTIVE' and expires_at > now()))
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'instructor')
  );

create trigger on_workshop_session_updated before update on public.workshop_sessions
  for each row execute function private.touch_orbit_user();

commit;
