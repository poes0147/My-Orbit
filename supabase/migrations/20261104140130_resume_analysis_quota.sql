begin;
create table private.resume_analysis_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index resume_attempts_user_time on private.resume_analysis_attempts(user_id, attempted_at);
create index resume_attempts_ip_time on private.resume_analysis_attempts(ip_hash, attempted_at);
create index resume_attempts_time on private.resume_analysis_attempts(attempted_at);
alter table private.resume_analysis_attempts enable row level security;
revoke all on private.resume_analysis_attempts from public, anon, authenticated;

-- Authenticated callers can only consume their own allowance, never supply a user ID.
create function public.claim_resume_analysis_attempt(p_ip_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Unauthorized or invalid quota request' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:resume:quota',0));
  delete from private.resume_analysis_attempts where attempted_at <= now() - interval '1 minute';
  if (select count(*) from private.resume_analysis_attempts where user_id=caller) >= 3
    or (select count(*) from private.resume_analysis_attempts where ip_hash=p_ip_hash) >= 3 then return false; end if;
  insert into private.resume_analysis_attempts(user_id, ip_hash) values(caller, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.claim_resume_analysis_attempt(text) from public, anon;
grant execute on function public.claim_resume_analysis_attempt(text) to authenticated;
select cron.schedule('orbit-expired-resume-attempts','*/5 * * * *',
  $$delete from private.resume_analysis_attempts where attempted_at <= now() - interval '1 minute'$$);
commit;
