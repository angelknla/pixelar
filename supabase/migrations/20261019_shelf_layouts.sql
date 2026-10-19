-- Pixelar only: sync shelf layouts without changing other profile preferences.
begin;
alter table public.pixelar_profiles add column if not exists shelf_layouts jsonb not null default '{}' check (jsonb_typeof(shelf_layouts) = 'object');
create or replace function public.pixelar_save_shelf_layout(owner_id uuid, view_key text, layout jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if view_key not in ('games_status','tv_status','tv_service')
    or jsonb_typeof(layout) is distinct from 'object'
    or jsonb_typeof(layout->'order') is distinct from 'array'
    or jsonb_typeof(layout->'collapsed') is distinct from 'array' then
    raise exception 'Invalid shelf layout';
  end if;
  if jsonb_array_length(layout->'order') > 100 or jsonb_array_length(layout->'collapsed') > 100 then
    raise exception 'Invalid shelf layout';
  end if;
  if exists(select 1 from jsonb_array_elements((layout->'order') || (layout->'collapsed')) as key(value)
    where jsonb_typeof(value) <> 'string' or length(value #>> '{}') not between 1 and 80) then
    raise exception 'Invalid shelf layout';
  end if;
  insert into public.pixelar_profiles(member_id,shelf_layouts)
  values(owner_id,jsonb_build_object(view_key,layout))
  on conflict(member_id) do update set shelf_layouts=jsonb_set(pixelar_profiles.shelf_layouts,array[view_key],layout,true);
end $$;
revoke all on function public.pixelar_save_shelf_layout(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pixelar_save_shelf_layout(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
