begin;

alter table public.project_items add column star_card jsonb check (star_card is null or jsonb_typeof(star_card) = 'object');
grant update (star_card) on public.project_items to authenticated;

create table private.project_card_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index project_card_attempts_user_time on private.project_card_attempts(user_id, attempted_at);
create index project_card_attempts_ip_time on private.project_card_attempts(ip_hash, attempted_at);
create index project_card_attempts_time on private.project_card_attempts(attempted_at);
alter table private.project_card_attempts enable row level security;
revoke all on private.project_card_attempts from public, anon, authenticated;

-- Authenticated callers can only consume their own allowance, never supply a user ID.
create function public.claim_project_card_attempt(p_ip_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Unauthorized or invalid quota request' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('orbit:project-card:quota',0));
  delete from private.project_card_attempts where attempted_at <= now() - interval '1 minute';
  if (select count(*) from private.project_card_attempts where user_id=caller) >= 5
    or (select count(*) from private.project_card_attempts where ip_hash=p_ip_hash) >= 5 then return false; end if;
  insert into private.project_card_attempts(user_id, ip_hash) values(caller, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.claim_project_card_attempt(text) from public, anon;
grant execute on function public.claim_project_card_attempt(text) to authenticated;
select cron.schedule('orbit-expired-project-card-attempts','*/5 * * * *',
  $$delete from private.project_card_attempts where attempted_at <= now() - interval '1 minute'$$);

-- Business conflicts must not trigger database serialization retries.
create or replace function public.commit_draft_to_profile(
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
  card jsonb;
  project_link text;
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
    raise exception 'PROFILE_CHANGED' using errcode = 'PT409';
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
    raise exception 'DRAFT_CHANGED' using errcode = 'PT409';
  end if;

  saved_content := coalesce(draft.answers->'edited_draft', draft.answers->'generated_draft');
  projection := jsonb_build_object('headline', saved_content->'headline',
    'competency_tags', saved_content->'competency_tags', 'project_summary', saved_content->'project_summary');
  if saved_content ? 'project_card' then
    card := saved_content->'project_card';
    if jsonb_typeof(card) is distinct from 'object'
      or exists (
        select 1 from (values ('title',120),('role',500),('context_line',180),('action_line',180),('result_line',180)) as f(name,max_length)
        where jsonb_typeof(card->f.name) is distinct from 'string'
          or length(btrim(card->>f.name)) not between 1 and f.max_length
      ) then
      raise exception 'INVALID_DRAFT_CONTENT' using errcode = '22023';
    end if;
    project_link := card->>'link_url';
    if project_link is not null and (length(project_link) > 2048 or project_link !~* '^https?://' or project_link ~ '[[:space:][:cntrl:]]') then
      raise exception 'INVALID_DRAFT_CONTENT' using errcode = '22023';
    end if;
    projection := projection || jsonb_build_object('project_card', card);
  end if;
  if projection is distinct from p_expected_content then
    raise exception 'DRAFT_CHANGED' using errcode = 'PT409';
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

  insert into public.project_items(profile_id, title, description, is_draft_derived, star_card, link_url)
    values (profile.id, coalesce(card->>'title', project_title),
      coalesce((card->>'context_line') || chr(10) || (card->>'action_line') || chr(10) || (card->>'result_line'), projection->>'project_summary'),
      true, card - 'title' - 'link_url', project_link)
  on conflict (profile_id) where is_draft_derived
    do update set title = excluded.title, description = excluded.description, star_card = excluded.star_card,
      link_url = case when excluded.star_card is null then project_items.link_url else excluded.link_url end;

  return jsonb_build_object('profileId', profile.id, 'isPublished', false, 'updatedAt', profile.updated_at);
end;
$$;

commit;
