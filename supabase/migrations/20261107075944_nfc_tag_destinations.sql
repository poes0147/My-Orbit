begin;

create type public.nfc_target_type as enum ('profile', 'custom_url');

alter table public.nfc_tags
  add column target_type public.nfc_target_type not null default 'profile',
  add column custom_url text,
  add column updated_at timestamptz;
update public.nfc_tags set updated_at = coalesce(mapped_at, created_at);
alter table public.nfc_tags
  alter column updated_at set default now(),
  alter column updated_at set not null,
  add constraint nfc_tags_destination_check check (
    (target_type = 'profile' and custom_url is null)
    or (
      target_type = 'custom_url' and custom_url is not null
      and char_length(custom_url) <= 500 and strpos(custom_url, chr(92)) = 0
      and custom_url ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})([/?#][^[:space:][:cntrl:]]*)?$'
      and substring(custom_url from '^https://([^/?#]+)') !~ '\.(localhost|local|internal|home|lan|test|invalid|onion|example|arpa)$'
    )
  );

-- Owners can change only their destination. Claim codes and ownership stay private.
grant select (tag_id, is_active, target_type, custom_url, updated_at) on public.nfc_tags to authenticated;
grant update (target_type, custom_url) on public.nfc_tags to authenticated;
create policy nfc_tags_owner_select on public.nfc_tags for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy nfc_tags_owner_destination_update on public.nfc_tags for update to authenticated
  using (is_active and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())))
  with check (is_active and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));

create function private.touch_nfc_tag_destination()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.target_type is distinct from old.target_type or new.custom_url is distinct from old.custom_url then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function private.touch_nfc_tag_destination() from public, anon, authenticated;
create trigger touch_nfc_tag_destination before update of target_type, custom_url on public.nfc_tags
  for each row execute function private.touch_nfc_tag_destination();

-- Extend the narrow public RPC projection, leaving the tag address and ownership intact.
drop function public.resolve_nfc_tag(text);
create function public.resolve_nfc_tag(p_tag_id text)
returns table (tag_status text, public_slug text, external_url text)
language sql stable security definer set search_path = '' as $$
  select case
    when not tag.is_active then 'inactive'
    when tag.mapped_at is null then 'unbound'
    when profile.id is null then 'unavailable'
    when tag.target_type = 'custom_url' then 'external'
    when profile.is_published then 'published'
    else 'unavailable'
  end,
  case when tag.is_active and tag.target_type = 'profile' and profile.is_published then profile.slug end,
  case when tag.is_active and tag.target_type = 'custom_url' and profile.id is not null then tag.custom_url end
  from public.nfc_tags tag
  left join public.profiles profile on profile.id = tag.profile_id
  where tag.tag_id = p_tag_id;
$$;
revoke all on function public.resolve_nfc_tag(text) from public, anon, authenticated;
grant execute on function public.resolve_nfc_tag(text) to anon, authenticated;

commit;
