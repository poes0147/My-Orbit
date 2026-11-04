-- LOCAL Supabase only. Synthetic accounts and assertions always roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('b6735987-30df-4846-bc57-66237effcf01','resume-a@example.invalid','{"full_name":"Resume A"}'),
('b6735987-30df-4846-bc57-66237effcf02','resume-b@example.invalid','{"full_name":"Resume B"}');
insert into public.resume_documents(id,user_id,file_name,mime_type,size_bytes,source_type,parsed_content,expires_at) values
('93240e07-bb10-425a-aee9-02838579ac01','b6735987-30df-4846-bc57-66237effcf01','own.txt','text/plain',100,'text','{}',now()+interval '24 hours'),
('93240e07-bb10-425a-aee9-02838579ac02','b6735987-30df-4846-bc57-66237effcf01','expired.txt','text/plain',100,'text','{}',now()-interval '1 second');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b6735987-30df-4846-bc57-66237effcf01","role":"authenticated"}',true);
do $$
begin
 if (select count(*) from public.resume_documents where user_id='b6735987-30df-4846-bc57-66237effcf01')<>1 then raise exception 'Own/unexpired read failed'; end if;
 begin
  update public.resume_documents set expires_at=now()+interval '2 days' where id='93240e07-bb10-425a-aee9-02838579ac01';
  raise exception 'Expiry extension permitted';
 exception when insufficient_privilege then null; end;
 if not public.claim_resume_analysis_attempt(repeat('a',64)) then raise exception 'First quota rejected'; end if;
 if not public.claim_resume_analysis_attempt(repeat('a',64)) then raise exception 'Second quota rejected'; end if;
 if not public.claim_resume_analysis_attempt(repeat('a',64)) then raise exception 'Third quota rejected'; end if;
 if public.claim_resume_analysis_attempt(repeat('a',64)) then raise exception 'Fourth quota allowed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b6735987-30df-4846-bc57-66237effcf02","role":"authenticated"}',true);
do $$
declare affected integer;
begin
 if exists(select 1 from public.resume_documents where user_id='b6735987-30df-4846-bc57-66237effcf01') then raise exception 'Cross-owner read allowed'; end if;
 update public.resume_documents set file_name='forbidden' where id='93240e07-bb10-425a-aee9-02838579ac01';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-owner update allowed'; end if;
 delete from public.resume_documents where id='93240e07-bb10-425a-aee9-02838579ac01';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-owner delete allowed'; end if;
 begin
  insert into public.resume_documents(user_id,file_name,mime_type,size_bytes,source_type,parsed_content)
  values('b6735987-30df-4846-bc57-66237effcf01','other.txt','text/plain',100,'text','{}');
  raise exception 'Cross-owner insert allowed';
 exception when insufficient_privilege then null; end;
 if public.claim_resume_analysis_attempt(repeat('a',64)) then raise exception 'Shared IP quota bypassed'; end if;
 if not public.claim_resume_analysis_attempt(repeat('b',64)) then raise exception 'Independent quota rejected'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.resume_documents limit 1; raise exception 'Anonymous resume read allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.claim_resume_analysis_attempt(repeat('c',64)); raise exception 'Anonymous quota allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
