begin;
select set_config('orbit.test_admin', (select id::text from public.users where role='admin' limit 1), true);
select set_config('orbit.test_other', (select id::text from public.users where role='participant' limit 1), true);
do $$ begin
  if nullif(current_setting('orbit.test_admin'),'') is null or nullif(current_setting('orbit.test_other'),'') is null then raise exception 'Requires admin and participant fixtures'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('orbit.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.workshop_sessions (session_code,title,organization_name,created_by,expires_at,max_capacity)
values ('ZZ9Z8Z','Rollback test','Test',auth.uid(),now()+interval '1 day',1);
do $$ begin
  if not exists(select 1 from public.workshop_sessions where session_code='ZZ9Z8Z') then raise exception 'Admin read denied'; end if;
  begin
    insert into public.workshop_sessions (session_code,title,organization_name,created_by,expires_at)
    values ('ZZ9Z8Z','Collision','Test',auth.uid(),now()+interval '1 day');
    raise exception 'Unique code missing';
  exception when unique_violation then null; end;
  begin
    update public.workshop_sessions set created_by=current_setting('orbit.test_other')::uuid where session_code='ZZ9Z8Z';
    raise exception 'Ownership mutable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('orbit.test_other'),'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true);
set local role authenticated;
do $$ declare result jsonb; affected integer; begin
  if exists(select 1 from public.workshop_sessions where session_code='ZZ9Z8Z') then raise exception 'Participant table read allowed'; end if;
  begin
    insert into public.workshop_sessions (session_code,title,organization_name,created_by,expires_at)
    values ('ZZ9Z7Z','Denied','Test',auth.uid(),now()+interval '1 day');
    raise exception 'Participant issued a code';
  exception when insufficient_privilege then null; end;
  update public.workshop_sessions set status='COMPLETED' where session_code='ZZ9Z8Z';
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Participant modified session'; end if;
  result:=public.verify_workshop_code('zz9z8z');
  if result->>'success' <> 'true' then raise exception 'Lowercase verification failed %',result; end if;
  result:=public.join_workshop_session('zz9z8z');
  if result->>'success' <> 'true' or public.current_workshop_session_id() is null then raise exception 'Join failed %',result; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('orbit.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare result jsonb; begin
  result:=public.verify_workshop_code('ZZ9Z8Z');
  if result#>>'{error,code}' <> 'SESSION_FULL' then raise exception 'Capacity verification failed %',result; end if;
  result:=public.join_workshop_session('ZZ9Z8Z');
  if result#>>'{error,code}' <> 'SESSION_FULL' then raise exception 'Capacity join failed %',result; end if;
end $$;
reset role;
-- Verify that even an instructor carrying forged admin user_metadata is denied.
update public.users set role='instructor' where id=current_setting('orbit.test_other')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('orbit.test_other'),'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true);
set local role authenticated;
do $$ declare affected integer; begin
  if exists(select 1 from public.workshop_sessions where session_code='ZZ9Z8Z') then raise exception 'Instructor read all codes'; end if;
  begin
    insert into public.workshop_sessions (session_code,title,organization_name,created_by,expires_at)
    values ('ZZ9Z7Z','Denied','Test',auth.uid(),now()+interval '1 day');
    raise exception 'Instructor issued a code';
  exception when insufficient_privilege then null; end;
  update public.workshop_sessions set status='COMPLETED' where session_code='ZZ9Z8Z';
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Instructor changed status'; end if;
end $$;
reset role;
-- Another admin must see and close sessions they did not create.
update public.users set role='admin' where id=current_setting('orbit.test_other')::uuid;
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.workshop_sessions where session_code='ZZ9Z8Z') then raise exception 'Global admin read denied'; end if;
end $$;
update public.workshop_sessions set status='COMPLETED' where session_code='ZZ9Z8Z';
do $$ declare result jsonb; begin
  result:=public.join_workshop_session('ZZ9Z8Z');
  if result#>>'{error,code}' <> 'SESSION_EXPIRED' then raise exception 'Closed session joined %',result; end if;
  begin
    update public.workshop_sessions set status='ACTIVE' where session_code='ZZ9Z8Z';
    raise exception 'Reopen permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.workshop_sessions set status='ACTIVE',starts_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where session_code='ZZ9Z8Z';
set local role authenticated;
do $$ declare result jsonb; begin
  result:=public.verify_workshop_code('ZZ9Z8Z');
  if result#>>'{error,code}' <> 'SESSION_EXPIRED' then raise exception 'Expired code allowed %',result; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.workshop_sessions;
    raise exception 'Anon table read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: admin global management, participant/instructor/forged-role denial, join/context, full/closed/expired codes and immutable owner; rolled back' as result;
rollback;
