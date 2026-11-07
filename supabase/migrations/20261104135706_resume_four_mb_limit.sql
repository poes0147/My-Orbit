begin;
-- User approved 4 MiB instead of 5 MiB to stay below Vercel's 4.5 MB request limit.
drop policy resume_analysis_owner_insert on public.resume_documents;
create policy resume_analysis_owner_insert on public.resume_documents for insert to authenticated
with check (user_id = (select auth.uid()) and storage_path is null
  and expires_at > now() and expires_at <= now() + interval '24 hours'
  and ((source_type = 'pdf' and mime_type = 'application/pdf' and size_bytes > 0 and size_bytes <= 4194304)
    or (source_type = 'text' and mime_type = 'text/plain' and size_bytes > 0 and size_bytes <= 32000)));
update storage.buckets set file_size_limit = 4194304 where id = 'resumes';
-- The memory-only implementation does not use Storage upload permissions.
drop policy if exists orbit_resume_owner_insert on storage.objects;
commit;
