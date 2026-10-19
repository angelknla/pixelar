-- Pixelar only: save each library's banner without changing other preferences.
begin;

alter table public.pixelar_profiles add column if not exists banner_items jsonb not null default '{}'
  check (jsonb_typeof(banner_items) = 'object');

create or replace function public.pixelar_save_banner(owner_id uuid, library_kind text, selected_item uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if library_kind is null or library_kind not in ('game','screen') then
    raise exception 'Invalid library';
  end if;

  if selected_item is not null and not exists (
    select 1 from public.pixelar_items
    where id = selected_item and member_id = owner_id
      and ((library_kind = 'game' and kind = 'game' and status = 'playing')
        or (library_kind = 'screen' and kind in ('movie','show') and status = 'watching'))
  ) then
    raise exception 'Banner title not found in this library';
  end if;

  insert into public.pixelar_profiles(member_id,banner_items)
  values(owner_id,jsonb_build_object(library_kind,selected_item))
  on conflict(member_id) do update
    set banner_items=jsonb_set(pixelar_profiles.banner_items,array[library_kind],coalesce(to_jsonb(selected_item::text),'null'::jsonb),true);
end $$;

revoke all on function public.pixelar_save_banner(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pixelar_save_banner(uuid,text,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
