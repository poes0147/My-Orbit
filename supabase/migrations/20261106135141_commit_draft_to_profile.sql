begin;
alter table public.profiles
  add column competency_tags text[] not null default '{}'
    check (cardinality(competency_tags) <= 3),
  add column last_draft_commit_key uuid;
alter table public.project_items add column is_draft_derived boolean not null default false;
create unique index project_items_one_draft_project
  on public.project_items(profile_id) where is_draft_derived;
grant update (competency_tags, last_draft_commit_key, updated_at) on public.profiles to authenticated;

create function public.commit_draft_to_profile(
  p_draft_session_id uuid,
  p_idempotency_key uuid,
  p_expected_content jsonb,
  p_existing_profile_id uuid
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  active_workshop uuid;
  draft public.ai_interview_sessions%rowtype;
  profile public.profiles%rowtype;
  saved_content jsonb;
  projection jsonb;
  tags text[];
  project_title text;
begin
  if actor is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if p_draft_session_id is null or p_idempotency_key is null then
    raise exception 'INVALID_DRAFT_CONTENT' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orbit:profile:' || actor::text, 0));
  select * into profile from public.profiles where user_id = actor for update;
  if profile.is_published then
    raise exception 'PUBLISHED_PROFILE_CONFLICT' using errcode = '23514';
  end if;
  if profile.last_draft_commit_key = p_idempotency_key then
    return jsonb_build_object('profileId', profile.id, 'isPublished', false, 'updatedAt', profile.updated_at);
  end if;
  if profile.id is distinct from p_existing_profile_id then
    raise exception 'PROFILE_CHANGED' using errcode = '40001';
  end if;

  active_workshop := public.current_workshop_session_id();
  select * into draft from public.ai_interview_sessions
    where user_id = actor and status = 'completed'
      and (active_workshop is null or workshop_session_id = active_workshop)
    order by created_at desc, id asc limit 1 for share;
  if not found then raise exception 'DRAFT_NOT_FOUND' using errcode = 'P0002'; end if;
  if draft.id <> p_draft_session_id then
    if not exists (select 1 from public.ai_interview_sessions where id = p_draft_session_id and user_id = actor) then
      raise exception 'DRAFT_NOT_FOUND' using errcode = 'P0002';
    end if;
    raise exception 'DRAFT_CHANGED' using errcode = '40001';
  end if;

  saved_content := coalesce(draft.answers->'edited_draft', draft.answers->'generated_draft');
  projection := jsonb_build_object('headline', saved_content->'headline',
    'competency_tags', saved_content->'competency_tags', 'project_summary', saved_content->'project_summary');
  if projection is distinct from p_expected_content then
    raise exception 'DRAFT_CHANGED' using errcode = '40001';
  end if;
  if jsonb_typeof(projection->'headline') is distinct from 'string'
    or jsonb_typeof(projection->'project_summary') is distinct from 'string'
    or jsonb_typeof(projection->'competency_tags') is distinct from 'array' then
    raise exception 'INVALID_DRAFT_CONTENT' using errcode = '22023';
  end if;
  if length(btrim(projection->>'headline')) not between 1 and 60
    or length(btrim(projection->>'project_summary')) not between 1 and 300
    or jsonb_array_length(projection->'competency_tags') <> 3
    or exists(select 1 from jsonb_array_elements(projection->'competency_tags') as t(value)
      where jsonb_typeof(t.value) <> 'string' or length(btrim(t.value #>> '{}')) not between 1 and 20) then
    raise exception 'INVALID_DRAFT_CONTENT' using errcode = '22023';
  end if;
  tags := array(select jsonb_array_elements_text(projection->'competency_tags'));
  project_title := coalesce(nullif(left(btrim(draft.answers #>> '{step_responses,project,title}'), 160), ''), '대표 프로젝트');

  if profile.id is null then
    insert into public.profiles(user_id, slug, headline, competency_tags, last_draft_commit_key)
      values (actor, 'user-' || replace(gen_random_uuid()::text, '-', ''), projection->>'headline', tags, p_idempotency_key)
      returning * into profile;
  else
    update public.profiles set headline = projection->>'headline', competency_tags = tags,
      last_draft_commit_key = p_idempotency_key, updated_at = now()
      where id = profile.id and user_id = actor returning * into profile;
  end if;

  insert into public.project_items(profile_id, title, description, is_draft_derived)
    values (profile.id, project_title, projection->>'project_summary', true)
  on conflict (profile_id) where is_draft_derived
    do update set title = excluded.title, description = excluded.description;

  return jsonb_build_object('profileId', profile.id, 'isPublished', false, 'updatedAt', profile.updated_at);
end;
$$;
revoke all on function public.commit_draft_to_profile(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.commit_draft_to_profile(uuid, uuid, jsonb, uuid) to authenticated;
commit;
