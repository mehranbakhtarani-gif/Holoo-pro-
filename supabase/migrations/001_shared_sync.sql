-- HOLLOO PRO+ shared sync foundation
-- Apply in a Supabase project's SQL Editor. Never expose service_role keys in clients.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','accountant','sales','warehouse','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = auth.uid()
  );
$$;

create table if not exists public.sync_records (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'product','party','invoice','invoice_line','stock_movement','party_ledger',
    'account','voucher','voucher_line','import_order','import_receipt',
    'import_receipt_line','product_valuation','treasury_entry','check'
  )),
  entity_id uuid not null,
  version bigint not null default 1 check (version > 0),
  payload jsonb not null,
  deleted_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, entity_type, entity_id)
);

create index if not exists sync_records_org_updated_idx
  on public.sync_records (organization_id, updated_at);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.sync_records enable row level security;

drop policy if exists "members can view organizations" on public.organizations;
create policy "members can view organizations" on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists "members can view their memberships" on public.organization_members;
create policy "members can view their memberships" on public.organization_members
  for select using (public.is_org_member(organization_id));

drop policy if exists "members can read sync records" on public.sync_records;
create policy "members can read sync records" on public.sync_records
  for select using (public.is_org_member(organization_id));

-- Mutations go through the RPC below so version checks and audit metadata are server-controlled.
drop policy if exists "clients cannot write sync records directly" on public.sync_records;
create policy "clients cannot write sync records directly" on public.sync_records
  for all using (false) with check (false);

create or replace function public.apply_sync_batch(p_organization_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  change jsonb;
  current_version bigint;
  next_version bigint;
  entity text;
  entity_uuid uuid;
  base bigint;
  result jsonb := '[]'::jsonb;
  changed_count integer := 0;
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 200 then
    raise exception 'invalid_batch';
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    entity := change->>'entity_type';
    entity_uuid := (change->>'entity_id')::uuid;
    base := coalesce((change->>'base_version')::bigint, 0);

    if entity not in (
      'product','party','invoice','invoice_line','stock_movement','party_ledger',
      'account','voucher','voucher_line','import_order','import_receipt',
      'import_receipt_line','product_valuation','treasury_entry','check'
    ) then
      raise exception 'invalid_entity_type';
    end if;

    select version into current_version
      from public.sync_records
      where organization_id = p_organization_id
        and entity_type = entity and entity_id = entity_uuid
      for update;

    if current_version is null then
      if base <> 0 then
        raise exception 'sync_conflict:%,%,expected_new_record', entity, entity_uuid using errcode = '40001';
      end if;
      next_version := 1;
      insert into public.sync_records(
        organization_id, entity_type, entity_id, version, payload, deleted_at, updated_by, updated_at
      ) values (
        p_organization_id, entity, entity_uuid, next_version,
        coalesce(change->'payload','{}'::jsonb),
        case when coalesce((change->>'deleted')::boolean,false) then now() else null end,
        auth.uid(), now()
      );
    else
      if current_version <> base then
        raise exception 'sync_conflict:%,%,server_version=%', entity, entity_uuid, current_version using errcode = '40001';
      end if;
      next_version := current_version + 1;
      update public.sync_records set
        version = next_version,
        payload = coalesce(change->'payload', payload),
        deleted_at = case when coalesce((change->>'deleted')::boolean,false) then now() else null end,
        updated_by = auth.uid(),
        updated_at = now()
      where organization_id = p_organization_id
        and entity_type = entity and entity_id = entity_uuid;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'entity_type', entity, 'entity_id', entity_uuid, 'version', next_version
    ));
    changed_count := changed_count + 1;
  end loop;

  return jsonb_build_object('applied', changed_count, 'records', result);
end;
$$;

revoke all on function public.apply_sync_batch(uuid,jsonb) from public;
grant execute on function public.apply_sync_batch(uuid,jsonb) to authenticated;
grant select on public.organizations, public.organization_members, public.sync_records to authenticated;

-- Bootstrap: the authenticated user creates an organization through this function.
create or replace function public.create_holoo_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'invalid_name'; end if;
  insert into public.organizations(name, owner_id) values (trim(p_name), auth.uid()) returning id into new_org;
  insert into public.organization_members(organization_id,user_id,role) values (new_org,auth.uid(),'owner');
  return new_org;
end;
$$;
revoke all on function public.create_holoo_organization(text) from public;
grant execute on function public.create_holoo_organization(text) to authenticated;
