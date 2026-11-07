-- Return only ownership status, never profile contents, for API 403/404 mapping.
create function public.profile_owner_status(p_profile_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'unauthorized'
    when not exists (select 1 from public.profiles where id = p_profile_id) then 'not_found'
    when exists (select 1 from public.profiles where id = p_profile_id and user_id = auth.uid()) then 'owner'
    else 'forbidden'
  end;
$$;
revoke all on function public.profile_owner_status(uuid) from public, anon, authenticated;
grant execute on function public.profile_owner_status(uuid) to authenticated;
