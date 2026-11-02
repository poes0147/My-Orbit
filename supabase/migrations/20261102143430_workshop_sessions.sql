begin;

create table public.workshop_sessions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null unique
    check (session_code ~ '^[A-Z0-9]{6}$'),
  title text not null check (length(btrim(title)) between 1 and 100),
  organization_name text not null check (length(btrim(organization_name)) between 1 and 100),
  status text not null default 'ACTIVE'
    check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
  max_capacity integer not null default 35 check (max_capacity between 1 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index workshop_sessions_active_expiry_idx
  on public.workshop_sessions (expires_at)
  where status = 'ACTIVE';

create table public.workshop_participants (
  workshop_session_id uuid not null references public.workshop_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  is_current boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (workshop_session_id, user_id)
);

create index workshop_participants_user_idx
  on public.workshop_participants (user_id);
create unique index workshop_participants_one_current_per_user_idx
  on public.workshop_participants (user_id)
  where is_current;

alter table public.workshop_sessions enable row level security;
alter table public.workshop_participants enable row level security;
revoke all on table public.workshop_sessions, public.workshop_participants from public, anon, authenticated;
grant all on table public.workshop_sessions, public.workshop_participants to service_role;

create table private.workshop_code_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index workshop_code_attempts_user_time_idx
  on private.workshop_code_attempts (user_id, attempted_at desc);
alter table private.workshop_code_attempts enable row level security;
revoke all on table private.workshop_code_attempts from public, anon, authenticated;

create function private.consume_workshop_code_attempt(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_attempts integer;
begin
  delete from private.workshop_code_attempts
  where user_id = p_user_id
    and attempted_at < now() - interval '1 day';

  select count(*)::integer into v_recent_attempts
  from private.workshop_code_attempts
  where user_id = p_user_id
    and attempted_at >= now() - interval '15 minutes';

  if v_recent_attempts >= 20 then
    return false;
  end if;

  insert into private.workshop_code_attempts (user_id) values (p_user_id);
  return true;
end;
$$;
revoke all on function private.consume_workshop_code_attempt(uuid) from public, anon, authenticated;

create function public.verify_workshop_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_session record;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'AUTH_REQUIRED', 'message', '로그인이 필요합니다.'));
  end if;

  if not private.consume_workshop_code_attempt(v_user_id) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RATE_LIMITED', 'message', '코드 확인 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요.'));
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_SESSION_CODE', 'message', '영문 대소문자와 숫자로 된 6자리 코드를 입력해 주세요.'));
  end if;

  select id, title, organization_name, status, starts_at, expires_at, max_capacity
    into v_session
  from public.workshop_sessions
  where session_code = v_code;

  if not found then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_NOT_FOUND', 'message', '존재하지 않는 세션 코드입니다.'));
  end if;

  if v_session.status <> 'ACTIVE' or v_session.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_EXPIRED', 'message', '종료되었거나 접근이 만료된 세션입니다.'));
  end if;

  if v_session.starts_at > now() then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_NOT_STARTED', 'message', '아직 시작되지 않은 세션입니다.'));
  end if;

  return jsonb_build_object('success', true, 'data', jsonb_build_object(
    'sessionId', v_session.id,
    'title', v_session.title,
    'organizationName', v_session.organization_name,
    'expiresAt', v_session.expires_at,
    'maxCapacity', v_session.max_capacity
  ));
end;
$$;

create function public.join_workshop_session(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_session record;
  v_is_member boolean;
  v_participant_count integer;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'AUTH_REQUIRED', 'message', '로그인이 필요합니다.'));
  end if;

  if not private.consume_workshop_code_attempt(v_user_id) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RATE_LIMITED', 'message', '코드 확인 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요.'));
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_SESSION_CODE', 'message', '영문 대소문자와 숫자로 된 6자리 코드를 입력해 주세요.'));
  end if;

  select id, title, organization_name, status, starts_at, expires_at, max_capacity
    into v_session
  from public.workshop_sessions
  where session_code = v_code
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_NOT_FOUND', 'message', '존재하지 않는 세션 코드입니다.'));
  end if;

  if v_session.status <> 'ACTIVE' or v_session.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_EXPIRED', 'message', '종료되었거나 접근이 만료된 세션입니다.'));
  end if;

  if v_session.starts_at > now() then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_NOT_STARTED', 'message', '아직 시작되지 않은 세션입니다.'));
  end if;

  perform 1 from public.users where id = v_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'PROFILE_NOT_FOUND', 'message', '회원 정보를 찾을 수 없습니다. 다시 로그인해 주세요.'));
  end if;

  select exists (
    select 1 from public.workshop_participants
    where workshop_session_id = v_session.id and user_id = v_user_id
  ) into v_is_member;

  if not v_is_member then
    select count(*)::integer into v_participant_count
    from public.workshop_participants
    where workshop_session_id = v_session.id;

    if v_participant_count >= v_session.max_capacity then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_FULL', 'message', '참여 인원이 가득 찬 세션입니다. 강사에게 문의해 주세요.'));
    end if;
  end if;

  update public.workshop_participants
    set is_current = false
  where user_id = v_user_id and is_current;

  insert into public.workshop_participants (workshop_session_id, user_id, is_current)
  values (v_session.id, v_user_id, true)
  on conflict (workshop_session_id, user_id)
  do update set is_current = true;

  return jsonb_build_object('success', true, 'data', jsonb_build_object(
    'bound', true,
    'sessionId', v_session.id,
    'title', v_session.title,
    'organizationName', v_session.organization_name,
    'redirectUrl', '/builder'
  ));
end;
$$;

create function public.current_workshop_session_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.workshop_participants p
  join public.workshop_sessions s on s.id = p.workshop_session_id
  where p.user_id = auth.uid()
    and p.is_current
    and s.status = 'ACTIVE'
    and s.starts_at <= now()
    and s.expires_at > now()
  limit 1;
$$;

create function public.get_current_workshop_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'AUTH_REQUIRED', 'message', '로그인이 필요합니다.'));
  end if;

  select s.id, s.title, s.organization_name, s.expires_at
    into v_session
  from public.workshop_participants p
  join public.workshop_sessions s on s.id = p.workshop_session_id
  where p.user_id = v_user_id
    and p.is_current
    and s.status = 'ACTIVE'
    and s.starts_at <= now()
    and s.expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NO_ACTIVE_SESSION', 'message', '참여 중인 워크숍이 없습니다.'));
  end if;

  return jsonb_build_object('success', true, 'data', jsonb_build_object(
    'sessionId', v_session.id,
    'title', v_session.title,
    'organizationName', v_session.organization_name,
    'expiresAt', v_session.expires_at
  ));
end;
$$;

revoke all on function public.verify_workshop_code(text) from public, anon, authenticated;
revoke all on function public.join_workshop_session(text) from public, anon, authenticated;
revoke all on function public.current_workshop_session_id() from public, anon, authenticated;
revoke all on function public.get_current_workshop_session() from public, anon, authenticated;
grant execute on function public.verify_workshop_code(text) to authenticated;
grant execute on function public.join_workshop_session(text) to authenticated;
grant execute on function public.current_workshop_session_id() to authenticated;
grant execute on function public.get_current_workshop_session() to authenticated;

commit;
