-- LOCAL ONLY. Exercise the actual commit RPC, ownership RLS and publication trigger.
begin;
insert into auth.users(id,email) values
('00000000-0000-4000-9000-000000000001','profile-a@example.invalid'),
('00000000-0000-4000-9000-000000000002','profile-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}',true);
insert into public.ai_interview_sessions(id,user_id,status,answers) values
('00000000-0000-4000-9000-000000000003','00000000-0000-4000-9000-000000000001','completed',
 '{"generated_draft":{"headline":"전시 운영 담당자","competency_tags":["기획","협업","실행"],"project_summary":"동료와 전시를 준비했습니다."}}');
do $$
declare saved jsonb; again jsonb; content jsonb; pid uuid;
begin
  content := '{"headline":"전시 운영 담당자","competency_tags":["기획","협업","실행"],"project_summary":"동료와 전시를 준비했습니다."}';
  saved := public.commit_draft_to_profile('00000000-0000-4000-9000-000000000003','00000000-0000-4000-9000-000000000004',content,null);
  pid := (saved->>'profileId')::uuid;
  if (saved->>'isPublished')::boolean then raise exception 'Save unexpectedly published'; end if;
  again := public.commit_draft_to_profile('00000000-0000-4000-9000-000000000003','00000000-0000-4000-9000-000000000004',content,null);
  if saved is distinct from again then raise exception 'Retry not idempotent'; end if;
  if (select count(*) from public.project_items where profile_id=pid)<>1 then raise exception 'Duplicate project on retry'; end if;
  begin
    update public.profiles set is_published=true where id=pid;
    raise exception 'Incomplete profile published';
  exception when check_violation then
    if sqlerrm <> 'incomplete_profile' then raise; end if;
  end;
  update public.profiles set display_name='검증 프로필', bio='다시 편집하고 저장한 문장' where id=pid;
  if (select bio from public.profiles where id=pid)<>'다시 편집하고 저장한 문장' then raise exception 'Edit not persisted'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.profiles) then raise exception 'Private profile leaked to anon'; end if;
  if exists(select 1 from public.project_items) then raise exception 'Private project leaked to anon'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.profiles) then raise exception 'Private profile leaked to other account'; end if;
  begin
    perform public.commit_draft_to_profile('00000000-0000-4000-9000-000000000003',gen_random_uuid(),'{}',null);
    raise exception 'Another account committed private draft';
  exception when no_data_found then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}',true);
update public.profiles set is_published=true;
do $$ begin
  begin
    perform public.commit_draft_to_profile('00000000-0000-4000-9000-000000000003',gen_random_uuid(),'{}',null);
    raise exception 'Published profile overwritten by draft';
  exception when check_violation then
    if sqlerrm <> 'PUBLISHED_PROFILE_CONFLICT' then raise; end if;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  if (select count(*) from public.profiles)<>1 then raise exception 'Published profile not visible'; end if;
  if (select count(*) from public.project_items)<>1 then raise exception 'Published project not visible'; end if;
  begin
    perform 1 from public.ai_interview_sessions; raise exception 'Interview leaked to anon';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
update public.profiles set is_published=false;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.profiles) then raise exception 'Unpublished profile still visible'; end if;
  if exists(select 1 from public.project_items) then raise exception 'Unpublished project still visible'; end if;
end $$;
reset role;
rollback;
