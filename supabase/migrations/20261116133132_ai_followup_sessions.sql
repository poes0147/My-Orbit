begin;
create table public.ai_followup_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 base_experience jsonb not null check(jsonb_typeof(base_experience)='object'),
 qa_history jsonb not null default '[]' check(jsonb_typeof(qa_history)='array' and jsonb_array_length(qa_history)<=3),
 revision integer not null default 0 check(revision>=0),
 status text not null default 'IN_PROGRESS' check(status in ('IN_PROGRESS','COMPLETED','ABANDONED')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 applied_at timestamptz,
 confirmed_experience jsonb
);
alter table public.ai_followup_sessions enable row level security;
revoke all on public.ai_followup_sessions from public,anon,authenticated;
grant select,delete on public.ai_followup_sessions to authenticated;
grant insert(id,user_id,base_experience) on public.ai_followup_sessions to authenticated;
grant update(qa_history,revision,status,applied_at,confirmed_experience) on public.ai_followup_sessions to authenticated;
create policy followup_read on public.ai_followup_sessions for select to authenticated using(user_id=(select auth.uid()) and expires_at>now());
create policy followup_insert on public.ai_followup_sessions for insert to authenticated with check(user_id=(select auth.uid()));
create policy followup_update on public.ai_followup_sessions for update to authenticated using(user_id=(select auth.uid()) and expires_at>now()) with check(user_id=(select auth.uid()) and expires_at>now());
create policy followup_delete on public.ai_followup_sessions for delete to authenticated using(user_id=(select auth.uid()));
create index followup_owner on public.ai_followup_sessions(user_id);
create index followup_expiry on public.ai_followup_sessions(expires_at);
select cron.schedule('orbit-expired-followup-sessions','*/5 * * * *',$$delete from public.ai_followup_sessions where expires_at<=now()$$);

create table private.followup_attempts(user_id uuid primary key references auth.users(id) on delete cascade,window_start timestamptz not null,attempts integer not null);
alter table private.followup_attempts enable row level security;
revoke all on private.followup_attempts from public,anon,authenticated;
create function public.claim_followup_attempt() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); allowed boolean;
begin
 if actor is null then raise exception 'UNAUTHORIZED' using errcode='42501'; end if;
 insert into private.followup_attempts values(actor,now(),1)
 on conflict(user_id) do update set
 attempts=case when followup_attempts.window_start<=now()-interval '1 minute' then 1 else followup_attempts.attempts+1 end,
 window_start=case when followup_attempts.window_start<=now()-interval '1 minute' then now() else followup_attempts.window_start end
 returning attempts<=5 into allowed;
 return allowed;
end; $$;
revoke all on function public.claim_followup_attempt() from public,anon,authenticated;
grant execute on function public.claim_followup_attempt() to authenticated;
commit;
