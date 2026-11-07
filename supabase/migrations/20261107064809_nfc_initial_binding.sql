begin;

create table public.nfc_tags (
  tag_id text primary key check (tag_id ~ '^[A-Za-z0-9]{4,32}$' and lower(tag_id) <> 'bind'),
  profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  claim_code_hash bytea,
  mapped_at timestamptz,
  created_at timestamptz not null default now(),
  check (claim_code_hash is null or octet_length(claim_code_hash) = 32),
  check ((mapped_at is null and profile_id is null and claim_code_hash is not null)
      or (mapped_at is not null and claim_code_hash is null))
);
create index nfc_tags_profile_id_idx on public.nfc_tags(profile_id);
alter table public.nfc_tags enable row level security;
revoke all on public.nfc_tags from public, anon, authenticated;

create table private.nfc_bind_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  attempted_at timestamptz not null
);
create index nfc_bind_attempts_user_time_idx on private.nfc_bind_attempts(user_id, attempted_at);
create index nfc_bind_attempts_ip_time_idx on private.nfc_bind_attempts(ip_hash, attempted_at);
create index nfc_bind_attempts_time_idx on private.nfc_bind_attempts(attempted_at);
alter table private.nfc_bind_attempts enable row level security;
revoke all on private.nfc_bind_attempts from public, anon, authenticated;

-- Provision from the database operator's SQL Editor with select * from private.issue_nfc_tag().
-- Put only /t/{tag_id} on the chip and QR. Hand the returned code to the recipient separately.
create function private.issue_nfc_tag()
returns table (tag_id text, registration_code text)
language plpgsql set search_path = '' as $$
begin
  tag_id := replace(gen_random_uuid()::text, '-', '');
  registration_code := replace(gen_random_uuid()::text, '-', '');
  insert into public.nfc_tags(tag_id, claim_code_hash)
  values (tag_id, sha256(convert_to(registration_code, 'UTF8')));
  return next;
end;
$$;
revoke all on function private.issue_nfc_tag() from public, anon, authenticated;

-- Public read contract returns a slug only for an active tag linked to a public profile.
create function public.resolve_nfc_tag(p_tag_id text)
returns table (tag_status text, public_slug text)
language sql stable security definer set search_path = '' as $$
  select case
    when not tag.is_active then 'inactive'
    when tag.mapped_at is null then 'unbound'
    when profile.is_published then 'published'
    else 'unavailable'
  end, case when tag.is_active and profile.is_published then profile.slug end
  from public.nfc_tags tag
  left join public.profiles profile on profile.id = tag.profile_id
  where tag.tag_id = p_tag_id;
$$;
revoke all on function public.resolve_nfc_tag(text) from public, anon, authenticated;
grant execute on function public.resolve_nfc_tag(text) to anon, authenticated;

create function public.bind_nfc_tag(p_tag_id text, p_registration_code text, p_ip_hash text)
returns table (result_code text, public_slug text, mapped_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  attempted timestamptz := clock_timestamp();
  own_profile public.profiles%rowtype;
  tag public.nfc_tags%rowtype;
begin
  if caller is null then
    return query select 'UNAUTHORIZED', null::text, null::timestamptz;
    return;
  end if;
  if p_tag_id is null or p_tag_id !~ '^[A-Za-z0-9]{4,32}$'
    or p_registration_code is null or p_registration_code !~ '^[a-f0-9]{32}$'
    or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return query select 'INVALID_INPUT', null::text, null::timestamptz;
    return;
  end if;

  -- Per-user quota also covers direct RPC calls and multiple browser sessions.
  perform pg_advisory_xact_lock(41058311, hashtext(caller::text));
  perform pg_advisory_xact_lock(41058312, hashtext(p_ip_hash));
  attempted := clock_timestamp();
  if (select count(*) from private.nfc_bind_attempts a where a.user_id = caller
      and a.attempted_at > attempted - interval '1 minute') >= 10
    or (select count(*) from private.nfc_bind_attempts a where a.ip_hash = p_ip_hash
      and a.attempted_at > attempted - interval '1 minute') >= 10 then
    return query select 'RATE_LIMITED', null::text, null::timestamptz;
    return;
  end if;
  insert into private.nfc_bind_attempts(user_id, ip_hash, attempted_at) values (caller, p_ip_hash, attempted);

  select p.* into own_profile from public.profiles p where p.user_id = caller for share;
  if not found then
    return query select 'PROFILE_NOT_FOUND', null::text, null::timestamptz;
    return;
  end if;
  if not own_profile.is_published then
    return query select 'PROFILE_NOT_PUBLISHED', null::text, null::timestamptz;
    return;
  end if;

  select t.* into tag from public.nfc_tags t where t.tag_id = p_tag_id for update;
  if not found then
    return query select 'TAG_NOT_FOUND', null::text, null::timestamptz;
  elsif not tag.is_active then
    return query select 'TAG_INACTIVE', null::text, null::timestamptz;
  elsif tag.profile_id = own_profile.id then
    return query select 'ALREADY_BOUND', own_profile.slug, tag.mapped_at;
  elsif tag.mapped_at is not null then
    return query select 'TAG_ALREADY_MAPPED', null::text, null::timestamptz;
  elsif tag.claim_code_hash is distinct from sha256(convert_to(p_registration_code, 'UTF8')) then
    return query select 'INVALID_CODE', null::text, null::timestamptz;
  else
    update public.nfc_tags t
    set profile_id = own_profile.id, claim_code_hash = null, mapped_at = clock_timestamp()
    where t.tag_id = p_tag_id
    returning t.mapped_at into tag.mapped_at;
    return query select 'SUCCESS', own_profile.slug, tag.mapped_at;
  end if;
end;
$$;
revoke all on function public.bind_nfc_tag(text, text, text) from public, anon, authenticated;
grant execute on function public.bind_nfc_tag(text, text, text) to authenticated;

select cron.schedule('orbit-expired-nfc-bind-attempts', '*/5 * * * *',
  $$delete from private.nfc_bind_attempts where attempted_at <= now() - interval '1 minute'$$);

commit;
