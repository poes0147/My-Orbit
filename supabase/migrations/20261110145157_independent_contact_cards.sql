begin;

create function private.is_public_https_url(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and char_length(value) <= 500 and strpos(value, chr(92)) = 0
    and value ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})([/?#][^[:space:][:cntrl:]]*)?$'
    and substring(value from '^https://([^/?#]+)') !~ '\.(localhost|local|internal|home|lan|test|invalid|onion|example|arpa)$';
$$;
revoke all on function private.is_public_https_url(text) from public, anon, authenticated;

create table public.contact_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_name text not null check (char_length(btrim(card_name)) between 1 and 40 and card_name !~ '[[:cntrl:]]'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80 and display_name !~ '[[:cntrl:]]'),
  phone_number text check (phone_number is null or (char_length(phone_number) between 1 and 40 and phone_number ~ '^\+?[0-9() .-]+$' and phone_number ~ '[0-9]')),
  email text check (email is null or (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@[:cntrl:]]+@[^[:space:]@[:cntrl:]]+\.[^[:space:]@[:cntrl:]]+$')),
  organization_name text check (organization_name is null or (char_length(organization_name) <= 100 and organization_name !~ '[[:cntrl:]]')),
  job_title text check (job_title is null or (char_length(job_title) <= 100 and job_title !~ '[[:cntrl:]]')),
  website_url text check (website_url is null or private.is_public_https_url(website_url)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index contact_cards_user_id_idx on public.contact_cards(user_id);
alter table public.contact_cards enable row level security;
revoke all on public.contact_cards from public, anon, authenticated;
grant select on public.contact_cards to authenticated;
create policy contact_cards_owner_read on public.contact_cards for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.nfc_tags
  add column owner_id uuid references auth.users(id) on delete cascade,
  add column card_id uuid,
  add column alias text check (alias is null or (char_length(btrim(alias)) between 1 and 40 and alias !~ '[[:cntrl:]]'));
update public.nfc_tags t set owner_id = p.user_id from public.profiles p where t.profile_id = p.id;
-- Orphans keep their claimed state, so they cannot be claimed by another account.
update public.nfc_tags set is_active = false where mapped_at is not null and owner_id is null;
alter table public.nfc_tags alter column target_type set default 'none';
alter table public.nfc_tags drop constraint nfc_tags_destination_check;
alter table public.nfc_tags add constraint nfc_tags_destination_check check (
  (target_type = 'profile' and custom_url is null and card_id is null)
  or (target_type = 'custom_url' and private.is_public_https_url(custom_url) and card_id is null)
  or (target_type = 'contact_card' and card_id is not null and owner_id is not null and custom_url is null)
  or (target_type = 'none' and card_id is null and custom_url is null)
);
alter table public.nfc_tags add constraint nfc_tags_card_owner_fkey
  foreign key (card_id, owner_id) references public.contact_cards(id, user_id);
create index nfc_tags_owner_id_idx on public.nfc_tags(owner_id);
create index nfc_tags_card_owner_idx on public.nfc_tags(card_id, owner_id);
drop policy nfc_tags_owner_select on public.nfc_tags;
drop policy nfc_tags_owner_destination_update on public.nfc_tags;
-- Revoke the pre-existing column grants too (table-level REVOKE does not remove them).
revoke update (target_type, custom_url) on public.nfc_tags from authenticated;
grant select (owner_id, card_id, alias) on public.nfc_tags to authenticated;
create policy nfc_tags_owner_select on public.nfc_tags for select to authenticated
  using (owner_id = (select auth.uid()));

-- Mutations are narrow RPCs. A per-owner lock serializes card edit/delete and
-- destination changes, including direct RPC requests; no privileged browser writes.
create function public.save_contact_card(p_card_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); saved uuid; candidate public.contact_cards%rowtype;
begin
  if caller is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:nfc:owner:' || caller::text, 0));
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid card' using errcode = '22023'; end if;
  if p_card_id is not null and not exists(select 1 from public.contact_cards where id=p_card_id and user_id=caller) then
    raise exception 'Card unavailable' using errcode = '42501';
  end if;
  candidate.card_name := btrim(p_data->>'card_name');
  candidate.display_name := btrim(p_data->>'display_name');
  candidate.phone_number := nullif(btrim(p_data->>'phone_number'), '');
  candidate.email := nullif(btrim(p_data->>'email'), '');
  candidate.organization_name := nullif(btrim(p_data->>'organization_name'), '');
  candidate.job_title := nullif(btrim(p_data->>'job_title'), '');
  candidate.website_url := nullif(btrim(p_data->>'website_url'), '');
  if candidate.phone_number is null and candidate.email is null
    and exists(select 1 from public.nfc_tags where card_id=p_card_id) then
    raise exception 'A linked card requires a contact' using errcode = '22023';
  end if;
  if p_card_id is null then
    insert into public.contact_cards(user_id,card_name,display_name,phone_number,email,organization_name,job_title,website_url)
    values(caller,candidate.card_name,candidate.display_name,candidate.phone_number,candidate.email,candidate.organization_name,candidate.job_title,candidate.website_url)
    returning id into saved;
  else
    update public.contact_cards set card_name=candidate.card_name, display_name=candidate.display_name,
      phone_number=candidate.phone_number,email=candidate.email,organization_name=candidate.organization_name,
      job_title=candidate.job_title,website_url=candidate.website_url,updated_at=clock_timestamp()
    where id=p_card_id and user_id=caller returning id into saved;
  end if;
  return saved;
end;
$$;
revoke all on function public.save_contact_card(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_contact_card(uuid,jsonb) to authenticated;

create function public.delete_contact_card(p_card_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:nfc:owner:' || caller::text, 0));
  if not exists(select 1 from public.contact_cards where id=p_card_id and user_id=caller) then return false; end if;
  update public.nfc_tags set target_type='none',card_id=null,custom_url=null,updated_at=clock_timestamp()
    where card_id=p_card_id and owner_id=caller;
  delete from public.contact_cards where id=p_card_id and user_id=caller;
  return true;
end;
$$;
revoke all on function public.delete_contact_card(uuid) from public, anon, authenticated;
grant execute on function public.delete_contact_card(uuid) to authenticated;

create function public.set_nfc_destination(p_tag_id text, p_target public.nfc_target_type,
  p_custom_url text default null, p_card_id uuid default null, p_alias text default null, p_acknowledged boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); own_profile uuid;
begin
  if caller is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:nfc:owner:' || caller::text, 0));
  if not exists(select 1 from public.nfc_tags where tag_id=p_tag_id and owner_id=caller and is_active) then return false; end if;
  if p_target in ('contact_card','custom_url') and p_acknowledged is not true then
    raise exception 'Public acknowledgement required' using errcode = '22023';
  end if;
  if p_target = 'contact_card' and not exists(select 1 from public.contact_cards
    where id=p_card_id and user_id=caller and (phone_number is not null or email is not null)) then
    raise exception 'Contact card unavailable' using errcode = '22023';
  end if;
  if p_target = 'profile' then
    select id into own_profile from public.profiles where user_id=caller and is_published;
    if own_profile is null then raise exception 'Published profile required' using errcode = '22023'; end if;
  end if;
  update public.nfc_tags set target_type=p_target,profile_id=own_profile,
    custom_url=case when p_target='custom_url' then p_custom_url end,
    card_id=case when p_target='contact_card' then p_card_id end,
    alias=nullif(btrim(p_alias),''),updated_at=clock_timestamp()
    where tag_id=p_tag_id and owner_id=caller and is_active;
  return true;
end;
$$;
revoke all on function public.set_nfc_destination(text,public.nfc_target_type,text,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.set_nfc_destination(text,public.nfc_target_type,text,uuid,text,boolean) to authenticated;

-- Removing a portfolio must not remove the account's objects or independent cards.
create function private.pause_deleted_profile_tags() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.nfc_tags set target_type='none',custom_url=null,card_id=null,profile_id=null,updated_at=clock_timestamp()
  where profile_id=old.id and target_type='profile';
  return old;
end;
$$;
revoke all on function private.pause_deleted_profile_tags() from public, anon, authenticated;
create trigger pause_deleted_profile_tags before delete on public.profiles
  for each row execute function private.pause_deleted_profile_tags();

create or replace function public.resolve_nfc_tag(p_tag_id text)
returns table(tag_status text, public_slug text, external_url text)
language sql stable security definer set search_path = '' as $$
  select case
    when not t.is_active then 'inactive'
    when t.mapped_at is null then 'unbound'
    when t.owner_id is null then 'unavailable'
    when t.target_type='none' then 'paused'
    when t.target_type='custom_url' then 'external'
    when t.target_type='contact_card' and c.id is not null and (c.phone_number is not null or c.email is not null) then 'contact'
    when t.target_type='profile' and p.is_published and p.user_id=t.owner_id then 'published'
    else 'unavailable' end,
    case when t.is_active and t.target_type='profile' and p.is_published and p.user_id=t.owner_id then p.slug end,
    case when t.is_active and t.owner_id is not null and t.target_type='custom_url' then t.custom_url end
  from public.nfc_tags t left join public.profiles p on p.id=t.profile_id
  left join public.contact_cards c on c.id=t.card_id and c.user_id=t.owner_id
  where t.tag_id=p_tag_id;
$$;
revoke all on function public.resolve_nfc_tag(text) from public, anon, authenticated;
grant execute on function public.resolve_nfc_tag(text) to anon, authenticated;

-- Only the selected card's public fields, only while the tag still points to it.
create function public.get_nfc_contact(p_tag_id text)
returns table(display_name text,phone_number text,email text,organization_name text,job_title text,website_url text)
language sql stable security definer set search_path = '' as $$
  select c.display_name,c.phone_number,c.email,c.organization_name,c.job_title,c.website_url
  from public.nfc_tags t join public.contact_cards c on c.id=t.card_id and c.user_id=t.owner_id
  where t.tag_id=p_tag_id and t.is_active and t.mapped_at is not null and t.target_type='contact_card'
    and (c.phone_number is not null or c.email is not null);
$$;
revoke all on function public.get_nfc_contact(text) from public, anon, authenticated;
grant execute on function public.get_nfc_contact(text) to anon, authenticated;

create or replace function public.bind_nfc_tag(p_tag_id text, p_registration_code text, p_ip_hash text)
returns table (result_code text, public_slug text, mapped_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  attempted timestamptz := clock_timestamp();
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

  select t.* into tag from public.nfc_tags t where t.tag_id = p_tag_id for update;
  if not found then
    return query select 'TAG_NOT_FOUND', null::text, null::timestamptz;
  elsif not tag.is_active then
    return query select 'TAG_INACTIVE', null::text, null::timestamptz;
  elsif tag.owner_id = caller then
    return query select 'ALREADY_BOUND', null::text, tag.mapped_at;
  elsif tag.mapped_at is not null then
    return query select 'TAG_ALREADY_MAPPED', null::text, null::timestamptz;
  elsif tag.claim_code_hash is distinct from sha256(convert_to(p_registration_code, 'UTF8')) then
    return query select 'INVALID_CODE', null::text, null::timestamptz;
  else
    update public.nfc_tags t
    set owner_id = caller, profile_id = null, target_type = 'none', card_id = null, custom_url = null, claim_code_hash = null, mapped_at = clock_timestamp()
    where t.tag_id = p_tag_id
    returning t.mapped_at into tag.mapped_at;
    return query select 'SUCCESS', null::text, tag.mapped_at;
  end if;
end;
$$;
revoke all on function public.bind_nfc_tag(text, text, text) from public, anon, authenticated;
grant execute on function public.bind_nfc_tag(text, text, text) to authenticated;


commit;
