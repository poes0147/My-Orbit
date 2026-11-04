-- Profile ownership foundation. Applied to my-orbit-dev on 2026-11-03.
begin;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 80),
  headline text not null default '' check (length(headline) <= 160),
  bio text not null default '' check (length(bio) <= 3000),
  theme_preset text not null default 'default' check (length(theme_preset) <= 40),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 3000),
  link_url text check (length(link_url) <= 2048),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_items_profile_sort_idx on public.project_items (profile_id, sort_order);

create table public.ai_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workshop_session_id uuid references public.workshop_sessions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_interview_sessions_user_idx on public.ai_interview_sessions (user_id, created_at desc);

create table public.resume_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (length(btrim(mime_type)) between 1 and 150),
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index resume_documents_user_idx on public.resume_documents (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.project_items enable row level security;
alter table public.ai_interview_sessions enable row level security;
alter table public.resume_documents enable row level security;

revoke all on public.profiles, public.project_items, public.ai_interview_sessions, public.resume_documents from public, anon, authenticated;
grant select on public.profiles, public.project_items to anon, authenticated;
grant insert on public.profiles, public.project_items, public.ai_interview_sessions, public.resume_documents to authenticated;
grant delete on public.profiles, public.project_items, public.ai_interview_sessions, public.resume_documents to authenticated;
grant select on public.ai_interview_sessions, public.resume_documents to authenticated;
grant update (slug, headline, bio, theme_preset, is_published) on public.profiles to authenticated;
grant update (title, description, link_url, sort_order) on public.project_items to authenticated;
grant update (status, answers) on public.ai_interview_sessions to authenticated;
grant update (file_name) on public.resume_documents to authenticated;
grant all on public.profiles, public.project_items, public.ai_interview_sessions, public.resume_documents to service_role;

create policy profiles_public_read on public.profiles for select to anon, authenticated
  using (is_published);
create policy profiles_owner_read on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_owner_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_owner_update on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_owner_delete on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy project_items_public_read on public.project_items for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.is_published));
create policy project_items_owner_read on public.project_items for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy project_items_owner_insert on public.project_items for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy project_items_owner_update on public.project_items for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy project_items_owner_delete on public.project_items for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));

create policy ai_interview_owner_access on public.ai_interview_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy resume_documents_owner_access on public.resume_documents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;
