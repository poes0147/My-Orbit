begin;

select set_config('orbit.nfc_owner', gen_random_uuid()::text, true);
select set_config('orbit.nfc_other', gen_random_uuid()::text, true);
insert into auth.users(id, email)
select id::uuid, id || '@orbit-fixture.example'
from unnest(array[current_setting('orbit.nfc_owner'), current_setting('orbit.nfc_other')]) as id;
insert into public.profiles(user_id, slug, headline, display_name, competency_tags, is_published)
values (current_setting('orbit.nfc_owner')::uuid, 'nfc-fixture-' || current_setting('orbit.nfc_owner'),
  'Fixture headline', 'Fixture name', array['Fixture tag'], true);
select set_config('orbit.nfc_tag', tag_id, true), set_config('orbit.nfc_claim', registration_code, true)
from private.issue_nfc_tag();

select set_config('request.jwt.claim.sub', current_setting('orbit.nfc_owner'), true);
set local role authenticated;
do $$
declare
  changed integer;
  invalid_url text;
begin
  if (select result_code from public.bind_nfc_tag(current_setting('orbit.nfc_tag'), current_setting('orbit.nfc_claim'), repeat('1', 64))) is distinct from 'SUCCESS' then
    raise exception 'Initial binding failed';
  end if;
  update public.nfc_tags set target_type = 'custom_url', custom_url = 'https://example.com/work?q=1#demo'
  where tag_id = current_setting('orbit.nfc_tag');
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Owner destination update denied'; end if;
  begin
    perform claim_code_hash from public.nfc_tags;
    raise exception 'Owner can read claim code hashes';
  exception when insufficient_privilege then null; end;
  begin
    update public.nfc_tags set is_active = false where tag_id = current_setting('orbit.nfc_tag');
    raise exception 'Owner can deactivate tags';
  exception when insufficient_privilege then null; end;
  foreach invalid_url in array array['http://example.com', 'https://127.0.0.1', 'https://192.168.1.1',
    'https://[::1]', 'https://a.internal', 'https://example.com@bad.com', 'https://example.com/a b',
    'https://example.com' || chr(92) || '@bad.com', null]
  loop
    begin
      update public.nfc_tags set custom_url = invalid_url where tag_id = current_setting('orbit.nfc_tag');
      raise exception 'Unsafe destination accepted';
    exception when check_violation then null; end;
  end loop;
end;
$$;

reset role;
set local role anon;
do $$ begin
  if (select external_url from public.resolve_nfc_tag(current_setting('orbit.nfc_tag'))) is distinct from 'https://example.com/work?q=1#demo' then
    raise exception 'Public routing did not switch to the external link';
  end if;
  begin
    perform custom_url from public.nfc_tags;
    raise exception 'Anonymous direct table read allowed';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('orbit.nfc_other'), true);
set local role authenticated;
do $$ declare changed integer; begin
  if exists (select 1 from public.nfc_tags where tag_id = current_setting('orbit.nfc_tag')) then
    raise exception 'Another account can list the tag';
  end if;
  update public.nfc_tags set target_type = 'profile', custom_url = null
  where tag_id = current_setting('orbit.nfc_tag');
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Another account modified the tag'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('orbit.nfc_owner'), true);
set local role authenticated;
update public.profiles set is_published = false where user_id = auth.uid();
do $$ begin
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.nfc_tag'))) is distinct from 'external' then
    raise exception 'Private profile broke an explicitly configured external link';
  end if;
  update public.nfc_tags set target_type = 'profile', custom_url = null
  where tag_id = current_setting('orbit.nfc_tag');
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.nfc_tag'))) is distinct from 'unavailable' then
    raise exception 'Private profile routing leaked';
  end if;
  update public.profiles set is_published = true where user_id = auth.uid();
  if (select public_slug from public.resolve_nfc_tag(current_setting('orbit.nfc_tag')))
    is distinct from ('nfc-fixture-' || current_setting('orbit.nfc_owner')) then
    raise exception 'Public profile routing was not restored';
  end if;
end $$;

reset role;
select 'PASS: NFC destination ACL, URL constraints, anonymous routing and profile restore' as result;
rollback;
