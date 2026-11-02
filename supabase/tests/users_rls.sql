-- Run in a development database after the migration, as postgres.
-- All synthetic accounts and changes are rolled back, including on failure.
begin;

insert into auth.users (id, email, raw_user_meta_data)
values ('a78dd2d8-2b9a-47fe-af56-9a59f5570d01', 'orbit-rls-a@example.invalid', '{"full_name":"RLS A","role":"instructor"}'),
       ('a78dd2d8-2b9a-47fe-af56-9a59f5570d02', 'orbit-rls-b@example.invalid', '{"full_name":"RLS B"}');

do $$
begin
  if (select count(*) from public.users where id in ('a78dd2d8-2b9a-47fe-af56-9a59f5570d01','a78dd2d8-2b9a-47fe-af56-9a59f5570d02')) <> 2 then
    raise exception 'Signup trigger did not create both profiles';
  end if;
  if (select role from public.users where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d01') <> 'participant' then
    raise exception 'Untrusted auth metadata granted elevated role';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a78dd2d8-2b9a-47fe-af56-9a59f5570d01","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.users where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d01') <> 1 then raise exception 'Cannot read own profile'; end if;
  if exists (select 1 from public.users where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d02') then raise exception 'Other user profile exposed'; end if;
  update public.users set name = 'Own update allowed' where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d01';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own name update failed'; end if;
  update public.users set name = 'Forbidden' where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d02';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other user profile updated'; end if;
  begin
    update public.users set role = 'instructor' where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d01';
    raise exception 'Role escalation allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.users set email = 'changed@example.invalid' where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d01';
    raise exception 'Identity change allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.users limit 1;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

delete from auth.users where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d02';
do $$
begin
  if exists (select 1 from public.users where id = 'a78dd2d8-2b9a-47fe-af56-9a59f5570d02') then raise exception 'Profile cascade delete failed'; end if;
end;
$$;
rollback;
