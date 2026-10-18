-- Additive Pixelar account setup for the shared Caelum Supabase project.
-- Caelum tables, accounts, functions, and grants are left untouched.
begin;

create table if not exists public.pixelar_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.pixelar_member_credentials (
  member_id uuid primary key references public.pixelar_members(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pixelar_members enable row level security;
alter table public.pixelar_member_credentials enable row level security;
revoke all on public.pixelar_members, public.pixelar_member_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.pixelar_members, public.pixelar_member_credentials to service_role;

create or replace function public.create_pixelar_account(
  account_name text,
  account_username text,
  account_email text,
  account_password_hash text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_member_id uuid;
begin
  insert into public.pixelar_members (name) values (account_name) returning id into new_member_id;
  insert into public.pixelar_member_credentials (member_id, username, email, password_hash)
    values (new_member_id, account_username, account_email, account_password_hash);
  return new_member_id;
end;
$$;

revoke all on function public.create_pixelar_account(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_pixelar_account(text, text, text, text) to service_role;


-- Library schema. Safe to rerun; all objects belong exclusively to Pixelar.
create table if not exists public.pixelar_profiles (
  member_id uuid primary key references public.pixelar_members(id) on delete cascade,
  region text not null default 'GB' check (region ~ '^[A-Z]{2}$'),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Europe/London',
  platforms text[] not null default '{}', services text[] not null default '{}',
  notifications_enabled boolean not null default true,
  default_release_reminder boolean not null default true,
  theme text not null default 'dark' check (theme in ('system','light','dark')),
  avatar_path text
);
alter table public.pixelar_profiles alter column theme set default 'dark';
create table if not exists public.pixelar_item_statuses (
  kind text not null check (kind in ('game','movie','show')),
  status text not null, position integer not null,
  primary key (kind,status)
);
insert into public.pixelar_item_statuses(kind,status,position)
select 'game',status,ordinality::integer from unnest(array['anticipated','scheduled','backlog','playing','replay','completed','dropped']) with ordinality as s(status,ordinality)
on conflict do nothing;
insert into public.pixelar_item_statuses(kind,status,position)
select kind,status,ordinality::integer from unnest(array['movie','show']) as k(kind), unnest(array['upcoming','watchlist','watching','watched','dropped']) with ordinality as s(status,ordinality)
on conflict do nothing;
create table if not exists public.pixelar_metadata_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('rawg','tmdb')),
  provider_id text not null, kind text not null check (kind in ('game','movie','show')),
  region text not null, fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  fetched_at timestamptz not null default now(),
  unique(provider,provider_id,kind,region), unique(id,kind)
);
create table if not exists public.pixelar_items (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.pixelar_members(id) on delete cascade,
  kind text not null, status text not null, metadata_id uuid,
  overrides jsonb not null default '{}' check (jsonb_typeof(overrides) = 'object'),
  platforms text[] not null default '{}', services text[] not null default '{}',
  price numeric(12,2) check (price >= 0), currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  notes text not null default '', auto_move boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,member_id),
  foreign key(kind,status) references public.pixelar_item_statuses(kind,status),
  foreign key(metadata_id,kind) references public.pixelar_metadata_cache(id,kind),
  check (kind = 'game' or (cardinality(platforms) = 0 and price is null)),
  check (kind <> 'game' or cardinality(services) = 0)
);
create index if not exists pixelar_items_owner_idx on public.pixelar_items(member_id);
create table if not exists public.pixelar_reminders (
  id uuid primary key default gen_random_uuid(), item_id uuid not null, member_id uuid not null,
  days_before integer not null check (days_before between 0 and 365),
  enabled boolean not null default true,
  channel text not null default 'in_app' check (channel = 'in_app'),
  unique(item_id,days_before,channel),
  foreign key(item_id,member_id) references public.pixelar_items(id,member_id) on delete cascade
);
create table if not exists public.pixelar_notifications (
  id uuid primary key default gen_random_uuid(), member_id uuid not null, item_id uuid not null,
  title text not null, delivery_key text not null unique,
  created_at timestamptz not null default now(), read_at timestamptz,
  foreign key(item_id,member_id) references public.pixelar_items(id,member_id) on delete cascade
);
create index if not exists pixelar_notifications_owner_idx on public.pixelar_notifications(member_id,created_at desc);

-- Service-role only. Browser roles have no access; server code must enforce ownership.
do $$
declare table_name text;
begin
  foreach table_name in array array['pixelar_profiles','pixelar_item_statuses','pixelar_items','pixelar_metadata_cache','pixelar_reminders','pixelar_notifications'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public, anon, authenticated',table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role',table_name);
  end loop;
end $$;

-- Save item and reminder changes atomically. The owner is supplied only by verified server code.
create or replace function public.pixelar_save_item(owner_id uuid,payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare item_uuid uuid; previous public.pixelar_items; reminder_day integer;
begin
  if payload->>'id' is not null then
    select * into previous from public.pixelar_items where id=(payload->>'id')::uuid and member_id=owner_id for update;
    if not found then raise exception 'Item not found' using errcode='P0002'; end if;
    if previous.kind <> payload->>'kind' then raise exception 'Item type cannot change'; end if;
    item_uuid := previous.id;
  else
    item_uuid := gen_random_uuid();
  end if;
  insert into public.pixelar_items(id,member_id,kind,status,metadata_id,overrides,platforms,services,price,currency,notes,auto_move)
  values(item_uuid,owner_id,payload->>'kind',payload->>'status',(payload->>'metadata_id')::uuid,
    payload->'overrides',array(select jsonb_array_elements_text(payload->'platforms')),
    array(select jsonb_array_elements_text(payload->'services')),(payload->>'price')::numeric,
    payload->>'currency',payload->>'notes',(payload->>'auto_move')::boolean)
  on conflict(id) do update set status=excluded.status,metadata_id=excluded.metadata_id,overrides=excluded.overrides,
    platforms=excluded.platforms,services=excluded.services,price=excluded.price,currency=excluded.currency,
    notes=excluded.notes,auto_move=excluded.auto_move,updated_at=now();
  delete from public.pixelar_reminders where item_id=item_uuid and member_id=owner_id
    and days_before not in (select value::integer from jsonb_array_elements_text(payload->'reminder_days'));
  for reminder_day in select value::integer from jsonb_array_elements_text(payload->'reminder_days') loop
    insert into public.pixelar_reminders(item_id,member_id,days_before) values(item_uuid,owner_id,reminder_day)
    on conflict(item_id,days_before,channel) do update set enabled=true;
  end loop;
  return item_uuid;
end $$;
revoke all on function public.pixelar_save_item(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pixelar_save_item(uuid,jsonb) to service_role;

create or replace function public.pixelar_update_profile(owner_id uuid,display_name text,new_email text,settings jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=settings->>'timezone') then raise exception 'Invalid timezone'; end if;
  update public.pixelar_members set name=display_name where id=owner_id;
  update public.pixelar_member_credentials set email=new_email,updated_at=now() where member_id=owner_id;
  insert into public.pixelar_profiles(member_id,region,currency,timezone,platforms,services,notifications_enabled,default_release_reminder,theme)
  values(owner_id,settings->>'region',settings->>'currency',settings->>'timezone',
    array(select jsonb_array_elements_text(settings->'platforms')),array(select jsonb_array_elements_text(settings->'services')),
    (settings->>'notifications_enabled')::boolean,(settings->>'default_release_reminder')::boolean,settings->>'theme')
  on conflict(member_id) do update set region=excluded.region,currency=excluded.currency,timezone=excluded.timezone,
    platforms=excluded.platforms,services=excluded.services,notifications_enabled=excluded.notifications_enabled,
    default_release_reminder=excluded.default_release_reminder,theme=excluded.theme;
end $$;
revoke all on function public.pixelar_update_profile(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pixelar_update_profile(uuid,text,text,jsonb) to service_role;

-- Signed-in page reconciliation. Transactional and concurrency safe.
create or replace function public.pixelar_process_releases(target_member uuid default null,run_at timestamptz default now()) returns integer
language plpgsql security invoker set search_path = '' as $$
declare entry record; effective jsonb; release_day date; local_now timestamp; reminder record; count_sent integer := 0; inserted integer;
begin
  for entry in
    select i.*,coalesce(p.timezone,'Europe/London') as timezone,coalesce(p.notifications_enabled,true) as notifications_enabled,
      coalesce(m.fields,'{}'::jsonb) as fetched
    from public.pixelar_items i left join public.pixelar_profiles p on p.member_id=i.member_id
    left join public.pixelar_metadata_cache m on m.id=i.metadata_id
    where target_member is null or i.member_id=target_member
    order by i.id for update of i
  loop
    effective := entry.fetched || entry.overrides;
    if effective->>'release_precision' is distinct from 'day' or effective->>'release_date' is null then continue; end if;
    begin release_day := (effective->>'release_date')::date; exception when others then continue; end;
    local_now := run_at at time zone entry.timezone;
    if release_day <= local_now::date and entry.auto_move and entry.status in ('scheduled','upcoming') then
      update public.pixelar_items set status=case when entry.kind='game' then 'backlog' else 'watchlist' end,updated_at=run_at
      where id=entry.id and member_id=entry.member_id;
    end if;
    if not entry.notifications_enabled then continue; end if;
    for reminder in select * from public.pixelar_reminders where item_id=entry.id and member_id=entry.member_id and enabled loop
      -- Do not send an advance reminder after release; the day-zero reminder catches up instead.
      if reminder.days_before > 0 and local_now::date >= release_day then continue; end if;
      if local_now >= (release_day - reminder.days_before)::timestamp + interval '9 hours' then
        insert into public.pixelar_notifications(member_id,item_id,title,delivery_key,created_at)
        values(entry.member_id,entry.id,
          coalesce(effective->>'title','Your title') || case when reminder.days_before=0 then ' has released!' else ' releases in ' || reminder.days_before || ' days' end,
          entry.id::text || ':' || release_day::text || ':' || reminder.days_before::text || ':' || reminder.channel,run_at)
        on conflict(delivery_key) do nothing;
        get diagnostics inserted = row_count; count_sent := count_sent + inserted;
      end if;
    end loop;
  end loop;
  return count_sent;
end $$;
revoke all on function public.pixelar_process_releases(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.pixelar_process_releases(uuid,timestamptz) to service_role;

-- Dedicated private bucket; Caelum's profile-avatars bucket is not used.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pixelar_avatars','pixelar_avatars',false,5242880,array['image/webp']) on conflict(id) do nothing;
-- Restrict only Pixelar's bucket, even if the shared project has broad permissive policies.
-- For all other buckets this restriction is true and existing Caelum policies keep their behavior.
do $$ begin
  if not exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='pixelar_private_avatars') then
    create policy pixelar_private_avatars on storage.objects as restrictive for all to anon,authenticated
      using (bucket_id <> 'pixelar_avatars') with check (bucket_id <> 'pixelar_avatars');
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
