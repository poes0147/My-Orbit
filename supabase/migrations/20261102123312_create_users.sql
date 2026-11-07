-- Apply through the Supabase migration workflow. No credentials belong here.
begin;

create type public.user_role as enum ('participant', 'instructor');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (length(btrim(email)) > 0),
  name text not null check (length(btrim(name)) > 0),
  avatar_url text,
  role public.user_role not null default 'participant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
-- Row ownership alone must not let a user promote themselves or change identity.
grant update (name, avatar_url) on table public.users to authenticated;
grant all on table public.users to service_role;

create policy users_read_own on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.create_orbit_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
             nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
             nullif(split_part(new.email, '@', 1), ''), '참여자'),
    new.raw_user_meta_data ->> 'avatar_url',
    'participant'
  );
  return new;
end;
$$;

revoke all on function private.create_orbit_user() from public, anon, authenticated;
create trigger on_orbit_auth_user_created
  after insert on auth.users for each row execute function private.create_orbit_user();

create function private.sync_orbit_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_orbit_user_email() from public, anon, authenticated;
create trigger on_orbit_auth_email_updated
  after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function private.sync_orbit_user_email();

create function private.touch_orbit_user()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_orbit_user() from public, anon, authenticated;
create trigger on_orbit_user_updated
  before update on public.users for each row execute function private.touch_orbit_user();

-- Also create the app profile for users who signed in before this migration.
insert into public.users (id, email, name, avatar_url, role)
select id, email,
       coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
                nullif(btrim(raw_user_meta_data ->> 'name'), ''),
                nullif(split_part(email, '@', 1), ''), '참여자'),
       raw_user_meta_data ->> 'avatar_url', 'participant'
from auth.users
where email is not null and length(btrim(email)) > 0
on conflict (id) do nothing;

-- A platform-created event-trigger helper is not a public RPC endpoint.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

commit;
