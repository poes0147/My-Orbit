begin;

-- Keep each account's allowance while allowing a 50-person shared network.
-- The IP allowance is a secondary aggregate guard, not a per-participant quota.
-- Keep the existing transaction lock so concurrent requests cannot oversubscribe.
create or replace function public.claim_resume_analysis_attempt(p_ip_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Unauthorized or invalid quota request' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:resume:quota',0));
  delete from private.resume_analysis_attempts where attempted_at <= now() - interval '1 minute';
  if (select count(*) from private.resume_analysis_attempts where user_id=caller) >= 3
    or (select count(*) from private.resume_analysis_attempts where ip_hash=p_ip_hash) >= 150 then return false; end if;
  insert into private.resume_analysis_attempts(user_id, ip_hash) values(caller, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.claim_resume_analysis_attempt(text) from public, anon;
grant execute on function public.claim_resume_analysis_attempt(text) to authenticated;

create or replace function public.claim_project_card_attempt(p_ip_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Unauthorized or invalid quota request' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:project-card:quota',0));
  delete from private.project_card_attempts where attempted_at <= now() - interval '1 minute';
  if (select count(*) from private.project_card_attempts where user_id=caller) >= 5
    or (select count(*) from private.project_card_attempts where ip_hash=p_ip_hash) >= 250 then return false; end if;
  insert into private.project_card_attempts(user_id, ip_hash) values(caller, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.claim_project_card_attempt(text) from public, anon;
grant execute on function public.claim_project_card_attempt(text) to authenticated;

-- NFC binding: 10 attempts per account, 500 per shared network.
create or replace function public.bind_nfc_tag(p_tag_id text, p_registration_code text, p_ip_hash text)
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
      and a.attempted_at > attempted - interval '1 minute') >= 500 then
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

commit;
