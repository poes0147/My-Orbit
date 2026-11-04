begin;

-- Keep the existing table and its canonical size_bytes column.
alter table public.resume_documents alter column storage_path drop not null;
alter table public.resume_documents
  add column source_type text not null default 'pdf' check (source_type in ('pdf', 'text')),
  add column parsed_content jsonb check (parsed_content is null or jsonb_typeof(parsed_content) = 'object'),
  add column expires_at timestamptz not null default (now() + interval '24 hours');
create index resume_documents_expiry_idx on public.resume_documents (expires_at);

alter table public.resume_documents enable row level security;
drop policy if exists resume_documents_owner_access on public.resume_documents;
revoke all on public.resume_documents from public, anon, authenticated;
grant select, delete on public.resume_documents to authenticated;
grant insert (user_id, storage_path, file_name, mime_type, size_bytes, source_type, parsed_content) on public.resume_documents to authenticated;
grant update (file_name) on public.resume_documents to authenticated;

create policy resume_analysis_owner_read on public.resume_documents for select to authenticated
  using (user_id = (select auth.uid()) and expires_at > now());
create policy resume_analysis_owner_insert on public.resume_documents for insert to authenticated
  with check (user_id = (select auth.uid()) and expires_at > now() and expires_at <= now() + interval '24 hours'
    and ((source_type = 'pdf' and mime_type = 'application/pdf' and size_bytes <= 5242880)
      or (source_type = 'text' and mime_type = 'text/plain' and size_bytes <= 32000)));
create policy resume_analysis_owner_update on public.resume_documents for update to authenticated
  using (user_id = (select auth.uid()) and expires_at > now())
  with check (user_id = (select auth.uid()) and expires_at > now());
create policy resume_analysis_owner_delete on public.resume_documents for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reserved private bucket; v1 parses originals in memory and never uploads them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf']) on conflict (id) do nothing;
create policy orbit_resume_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy orbit_resume_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy orbit_resume_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Only metadata created by the in-memory path is eligible for this cleanup.
-- Storage-backed documents must be removed through Storage API, not SQL.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('orbit-expired-resume-analysis', '* * * * *',
  $$delete from public.resume_documents where expires_at <= now() and storage_path is null$$);

commit;
