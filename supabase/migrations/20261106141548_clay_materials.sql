begin;
create table public.clay_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 50),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(code) <= 50),
  color_code text not null check (color_code ~ '^#[0-9A-F]{6}$'),
  type text not null check (type in ('base','premixed')),
  description text not null default '' check (length(description) <= 300),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clay_recipes (
  id uuid primary key default gen_random_uuid(),
  result_name text not null unique check (length(btrim(result_name)) between 1 and 50),
  result_color_code text not null check (result_color_code ~ '^#[0-9A-F]{6}$'),
  description text not null default '' check (length(description) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clay_recipe_items (
  recipe_id uuid not null references public.clay_recipes(id) on delete cascade,
  material_id uuid not null references public.clay_materials(id) on delete restrict,
  parts integer not null check (parts between 1 and 100),
  primary key (recipe_id, material_id)
);
create index clay_recipe_items_material_idx on public.clay_recipe_items(material_id);
alter table public.clay_materials enable row level security;
alter table public.clay_recipes enable row level security;
alter table public.clay_recipe_items enable row level security;
revoke all on public.clay_materials, public.clay_recipes, public.clay_recipe_items from public, anon, authenticated;
grant select on public.clay_materials, public.clay_recipes, public.clay_recipe_items to anon, authenticated;
grant insert, update on public.clay_materials, public.clay_recipes to authenticated;
grant insert, delete on public.clay_recipe_items to authenticated;
create policy clay_materials_active_read on public.clay_materials for select to anon, authenticated using (is_active);
create policy clay_recipes_active_read on public.clay_recipes for select to anon, authenticated using (is_active);
create policy clay_recipe_items_active_read on public.clay_recipe_items for select to anon, authenticated
  using (exists (select 1 from public.clay_recipes r where r.id = recipe_id and r.is_active));
create policy clay_materials_admin on public.clay_materials for all to authenticated
  using ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin')
  with check ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin');
create policy clay_recipes_admin on public.clay_recipes for all to authenticated
  using ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin')
  with check ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin');
create policy clay_recipe_items_admin on public.clay_recipe_items for all to authenticated
  using ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin')
  with check ((select u.role from public.users u where u.id = (select auth.uid())) = 'admin');

create function public.guard_clay_material() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.type <> 'base' and exists (
    select 1 from public.clay_recipe_items where material_id = old.id
  ) then raise exception 'MATERIAL_IN_USE' using errcode = 'PT409'; end if;
  if old.is_active and not new.is_active and exists (
    select 1 from public.clay_recipe_items i join public.clay_recipes r on r.id = i.recipe_id
      where i.material_id = old.id and r.is_active
  ) then raise exception 'MATERIAL_IN_USE' using errcode = 'PT409'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger clay_material_guard before update on public.clay_materials
  for each row execute function public.guard_clay_material();
revoke all on function public.guard_clay_material() from public, anon, authenticated;

create function public.save_clay_recipe(p_id uuid, p_recipe jsonb, p_items jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  saved_id uuid;
  item_count integer;
  active boolean := (p_recipe->>'is_active')::boolean;
begin
  if (select u.role from public.users u where u.id = auth.uid()) is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 2 or active is null then
    raise exception 'INVALID_RECIPE' using errcode = '22023';
  end if;
  perform m.id from public.clay_materials m
    where m.id in (select x.material_id from jsonb_to_recordset(p_items) x(material_id uuid, parts integer))
    order by m.id for share;
  select count(*) into item_count from public.clay_materials m
    where m.id in (select x.material_id from jsonb_to_recordset(p_items) x(material_id uuid, parts integer))
      and m.type = 'base' and (not active or m.is_active);
  if item_count <> jsonb_array_length(p_items) then
    raise exception 'INVALID_RECIPE_MATERIALS' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.clay_recipes(result_name,result_color_code,description,is_active)
      values (p_recipe->>'result_name',p_recipe->>'result_color_code',p_recipe->>'description',active) returning id into saved_id;
  else
    update public.clay_recipes set result_name=p_recipe->>'result_name',result_color_code=p_recipe->>'result_color_code',
      description=p_recipe->>'description',is_active=active,updated_at=now()
      where id=p_id returning id into saved_id;
    if saved_id is null then raise exception 'RECIPE_NOT_FOUND' using errcode = 'P0002'; end if;
    delete from public.clay_recipe_items where recipe_id=saved_id;
  end if;
  insert into public.clay_recipe_items(recipe_id,material_id,parts)
    select saved_id,x.material_id,x.parts from jsonb_to_recordset(p_items) x(material_id uuid,parts integer);
  return saved_id;
end;
$$;
revoke all on function public.save_clay_recipe(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_clay_recipe(uuid,jsonb,jsonb) to authenticated;
commit;
