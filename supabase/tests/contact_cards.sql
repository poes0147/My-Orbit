begin;
select set_config('orbit.card_owner',gen_random_uuid()::text,true),set_config('orbit.card_other',gen_random_uuid()::text,true);
insert into auth.users(id,email) select id::uuid,id||'@example.invalid' from unnest(array[current_setting('orbit.card_owner'),current_setting('orbit.card_other')]) id;
select set_config('orbit.tag1',tag_id,true),set_config('orbit.claim1',registration_code,true) from private.issue_nfc_tag();
select set_config('orbit.tag2',tag_id,true),set_config('orbit.claim2',registration_code,true) from private.issue_nfc_tag();
select set_config('request.jwt.claim.sub',current_setting('orbit.card_owner'),true);
set local role authenticated;
do $$ declare card uuid; draft uuid; begin
  if (select result_code from public.bind_nfc_tag(current_setting('orbit.tag1'),current_setting('orbit.claim1'),repeat('a',64))) <> 'SUCCESS' then raise exception 'Profileless bind failed'; end if;
  if (select result_code from public.bind_nfc_tag(current_setting('orbit.tag2'),current_setting('orbit.claim2'),repeat('a',64))) <> 'SUCCESS' then raise exception 'Second bind failed'; end if;
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.tag1'))) <> 'paused' then raise exception 'New claim automatically published'; end if;
  draft := public.save_contact_card(null,'{"card_name":"draft","display_name":"Name"}');
  begin
    perform public.set_nfc_destination(current_setting('orbit.tag1'),'contact_card',null,draft,null,true);
    raise exception 'Incomplete card linked';
  exception when invalid_parameter_value then null; end;
  card := public.save_contact_card(null,'{"card_name":"private label","display_name":"Public Name","phone_number":"010-1234-5678","organization_name":"Orbit"}');
  perform set_config('orbit.card',card::text,true);
  if exists(select 1 from public.get_nfc_contact(current_setting('orbit.tag1'))) then raise exception 'Unlinked card leaked'; end if;
  begin
    perform public.set_nfc_destination(current_setting('orbit.tag1'),'contact_card',null,card);
    raise exception 'Missing acknowledgement accepted';
  exception when invalid_parameter_value then null; end;
  perform public.set_nfc_destination(current_setting('orbit.tag1'),'contact_card',null,card,'Office',true);
  perform public.set_nfc_destination(current_setting('orbit.tag2'),'contact_card',null,card,'Home',true);
  begin
    perform public.save_contact_card(card,'{"card_name":"Empty","display_name":"Name"}');
    raise exception 'Removed all contact details while linked';
  exception when invalid_parameter_value then null; end;
  begin
    update public.nfc_tags set target_type='none' where tag_id=current_setting('orbit.tag1');
    raise exception 'Direct write bypass';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_contact_card(null,jsonb_build_object('card_name','bad','display_name','Name'||chr(10)||'TEL:evil'));
    raise exception 'vCard injection accepted';
  exception when check_violation then null; end;
  begin
    perform public.set_nfc_destination(current_setting('orbit.tag1'),'profile');
    raise exception 'Missing profile accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.tag1'))) <> 'contact' then raise exception 'No independent contact route'; end if;
  if (select display_name from public.get_nfc_contact(current_setting('orbit.tag1'))) <> 'Public Name' then raise exception 'No public card'; end if;
  begin perform id from public.contact_cards; raise exception 'Anonymous card list allowed'; exception when insufficient_privilege then null; end;
  begin perform public.delete_contact_card(current_setting('orbit.card')::uuid); raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('orbit.card_other'),true);
set local role authenticated;
do $$ declare other_card uuid; begin
  if exists(select 1 from public.contact_cards) then raise exception 'Cross-account card list'; end if;
  if exists(select 1 from public.nfc_tags) then raise exception 'Cross-account tag list'; end if;
  if public.delete_contact_card(current_setting('orbit.card')::uuid) then raise exception 'Cross-account deletion'; end if;
  begin perform public.save_contact_card(current_setting('orbit.card')::uuid,'{"card_name":"stolen","display_name":"stolen"}'); raise exception 'Cross-account update'; exception when insufficient_privilege then null; end;
  if public.set_nfc_destination(current_setting('orbit.tag1'),'none') then raise exception 'Cross-account switch'; end if;
  other_card := public.save_contact_card(null,'{"card_name":"Other","display_name":"Other","email":"other@example.com"}');
  perform set_config('orbit.other_card',other_card::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('orbit.card_owner'),true);
set local role authenticated;
do $$ begin
  begin
    perform public.set_nfc_destination(current_setting('orbit.tag1'),'contact_card',null,current_setting('orbit.other_card')::uuid,null,true);
    raise exception 'Foreign card linked';
  exception when invalid_parameter_value then null; end;
  perform public.save_contact_card(current_setting('orbit.card')::uuid,'{"card_name":"private label","display_name":"Updated Name","email":"new@example.com"}');
  if (select display_name from public.get_nfc_contact(current_setting('orbit.tag2'))) <> 'Updated Name' then raise exception 'Shared card edit not propagated'; end if;
  perform public.set_nfc_destination(current_setting('orbit.tag1'),'custom_url','https://instagram.com/myorbit',null,null,true);
  if exists(select 1 from public.get_nfc_contact(current_setting('orbit.tag1'))) then raise exception 'Old contact URL leaks after switch'; end if;
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.tag2'))) <> 'contact' then raise exception 'Other tag incorrectly switched'; end if;
  perform public.delete_contact_card(current_setting('orbit.card')::uuid);
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.tag2'))) <> 'paused' then raise exception 'Delete did not pause'; end if;
  if exists(select 1 from public.get_nfc_contact(current_setting('orbit.tag2'))) then raise exception 'Deleted card served'; end if;
end $$;
reset role;
-- Profile deletion preserves an account's objects, and never reopens claim codes.
set local role authenticated;
select set_config('orbit.preserved_card',public.save_contact_card(null,'{"card_name":"Keep","display_name":"Keep","email":"keep@example.com"}')::text,true);
select public.set_nfc_destination(current_setting('orbit.tag1'),'contact_card',null,current_setting('orbit.preserved_card')::uuid,null,true);
reset role;
update public.nfc_tags set is_active=false where tag_id=current_setting('orbit.tag1');
do $$ begin
  if exists(select 1 from public.get_nfc_contact(current_setting('orbit.tag1'))) then raise exception 'Disabled tag exposes card'; end if;
end $$;
update public.nfc_tags set is_active=true where tag_id=current_setting('orbit.tag1');
insert into public.profiles(user_id,slug,display_name,headline,competency_tags,is_published)
values(current_setting('orbit.card_owner')::uuid,'card-fixture','Name','Headline',array['tag'],true);
set local role authenticated;
select public.set_nfc_destination(current_setting('orbit.tag2'),'profile');
reset role;
delete from public.profiles where user_id=current_setting('orbit.card_owner')::uuid;
do $$ begin
  if (select display_name from public.get_nfc_contact(current_setting('orbit.tag1'))) <> 'Keep' then raise exception 'Profile deletion broke independent card'; end if;
  if (select tag_status from public.resolve_nfc_tag(current_setting('orbit.tag2'))) <> 'paused' then raise exception 'Profile delete did not pause'; end if;
  if not exists(select 1 from public.nfc_tags where tag_id=current_setting('orbit.tag2') and owner_id=current_setting('orbit.card_owner')::uuid and mapped_at is not null and claim_code_hash is null) then raise exception 'Ownership lost'; end if;
end $$;
-- Deleting an account also safely removes its cards and tags.
delete from auth.users where id=current_setting('orbit.card_owner')::uuid;
rollback;
