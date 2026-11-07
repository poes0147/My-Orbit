begin;

create index workshop_sessions_created_by_idx
  on public.workshop_sessions (created_by);

alter table private.workshop_code_attempts
  add column id bigint generated always as identity;
alter table private.workshop_code_attempts
  add constraint workshop_code_attempts_pkey primary key (id);

commit;
