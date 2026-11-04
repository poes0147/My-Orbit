create or replace function public.verify_workshop_code(p_code text)
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

  if not exists (
    select 1 from public.workshop_participants
    where workshop_session_id = v_session.id and user_id = v_user_id
  ) and (select count(*) from public.workshop_participants where workshop_session_id = v_session.id) >= v_session.max_capacity then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'SESSION_FULL', 'message', '참여 인원이 가득 찬 세션입니다. 강사에게 문의해 주세요.'));
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


