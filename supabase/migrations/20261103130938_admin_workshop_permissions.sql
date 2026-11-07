begin;
alter policy instructor_sessions_read on public.workshop_sessions rename to admin_sessions_read;
alter policy instructor_sessions_create on public.workshop_sessions rename to admin_sessions_create;
alter policy instructor_sessions_update on public.workshop_sessions rename to admin_sessions_update;
alter policy admin_sessions_read on public.workshop_sessions
using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));
alter policy admin_sessions_create on public.workshop_sessions
with check (
  created_by = (select auth.uid()) and status = 'ACTIVE'
  and expires_at > now() and expires_at <= now() + interval '7 days'
  and session_code ~ '^[A-HJ-NP-Z2-9]{6}$'
  and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin')
);
alter policy admin_sessions_update on public.workshop_sessions
using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'))
with check (status = 'COMPLETED' and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));
-- Column grants still permit status only, never ownership/code/expiry.
commit;
