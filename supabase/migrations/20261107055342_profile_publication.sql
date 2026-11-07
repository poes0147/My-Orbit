begin;

grant update (display_name) on public.profiles to authenticated;

create function private.validate_profile_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.is_published = new.is_published then
      return new;
    end if;
    new.updated_at := now();
  end if;

  if new.is_published and (
    coalesce(new.display_name, '') !~ '[^[:space:]]'
    or new.headline !~ '[^[:space:]]'
    or not exists (
      select 1 from unnest(new.competency_tags) as tag
      where tag ~ '[^[:space:]]'
    )
  ) then
    raise exception using errcode = '23514', message = 'incomplete_profile';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_profile_publication() from public, anon, authenticated;
create trigger validate_profile_publication
  before insert or update of is_published on public.profiles
  for each row execute function private.validate_profile_publication();

commit;
