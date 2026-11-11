begin;

-- The ledger prevents duplicate issuance without retaining recoverable claim codes.
create table private.nfc_tag_issuances (
  request_id uuid primary key,
  issued_by uuid references auth.users(id) on delete set null,
  tag_id text not null references public.nfc_tags(tag_id),
  created_at timestamptz not null default now()
);
create index nfc_tag_issuances_issued_by_idx on private.nfc_tag_issuances(issued_by);
create index nfc_tag_issuances_tag_id_idx on private.nfc_tag_issuances(tag_id);
create index nfc_tags_created_id_idx on public.nfc_tags(created_at desc, tag_id desc);
alter table private.nfc_tag_issuances enable row level security;
revoke all on private.nfc_tag_issuances from public, anon, authenticated;

create function public.admin_issue_nfc_tag(p_request_id uuid)
returns table(tag_id text, registration_code text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_existing private.nfc_tag_issuances%rowtype; v_issued record; v_attempt integer;
begin
  if v_actor is null or not exists(select 1 from public.users u where u.id=v_actor and u.role='admin') then
    raise exception 'Admin required' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_existing from private.nfc_tag_issuances i where i.request_id=p_request_id;
  if found then
    if v_existing.issued_by is distinct from v_actor then raise exception 'Request conflict' using errcode='42501'; end if;
    return query select t.tag_id,null::text,t.created_at from public.nfc_tags t where t.tag_id=v_existing.tag_id;
    return;
  end if;
  for v_attempt in 1..5 loop
    begin
      select * into v_issued from private.issue_nfc_tag();
      exit;
    exception when unique_violation then
      if v_attempt=5 then raise; end if;
    end;
  end loop;
  insert into private.nfc_tag_issuances(request_id,issued_by,tag_id) values(p_request_id,v_actor,v_issued.tag_id);
  return query select t.tag_id,v_issued.registration_code,t.created_at from public.nfc_tags t where t.tag_id=v_issued.tag_id;
end $$;
revoke all on function public.admin_issue_nfc_tag(uuid) from public, anon, authenticated;
grant execute on function public.admin_issue_nfc_tag(uuid) to authenticated;

-- Do not widen table SELECT grants: the owner-facing table includes the hash.
-- This narrow admin projection is the only new read surface.
create function public.admin_list_nfc_tags(p_page integer default 1,p_limit integer default 20)
returns table(tag_id text,is_active boolean,is_registered boolean,created_at timestamptz,registered_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.users u where u.id=auth.uid() and u.role='admin') then
    raise exception 'Admin required' using errcode='42501';
  end if;
  if p_page is null or p_limit is null or p_page<1 or p_page>1000000 or p_limit<1 or p_limit>100 then
    raise exception 'Invalid pagination' using errcode='22023';
  end if;
  return query select t.tag_id,t.is_active,(t.mapped_at is not null),t.created_at,t.mapped_at,count(*) over()
    from public.nfc_tags t order by t.created_at desc,t.tag_id desc limit p_limit offset ((p_page::bigint-1)*p_limit);
end $$;
revoke all on function public.admin_list_nfc_tags(integer,integer) from public, anon, authenticated;
grant execute on function public.admin_list_nfc_tags(integer,integer) to authenticated;
commit;
