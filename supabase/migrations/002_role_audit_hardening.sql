-- HOLLOO PRO+ shared sync hardening
-- Apply after 001_shared_sync.sql. Adds role-aware writes and an append-only audit trail.

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('CREATE','UPDATE','DELETE')),
  entity_type text not null,
  entity_id uuid not null,
  previous_version bigint,
  new_version bigint not null check (new_version > 0),
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on public.audit_events (organization_id, created_at desc);
create index if not exists audit_events_entity_idx
  on public.audit_events (organization_id, entity_type, entity_id, created_at desc);

alter table public.audit_events enable row level security;
drop policy if exists "members can read audit events" on public.audit_events;
create policy "members can read audit events" on public.audit_events
  for select using (public.is_org_member(organization_id));
drop policy if exists "clients cannot mutate audit events" on public.audit_events;
create policy "clients cannot mutate audit events" on public.audit_events
  for all using (false) with check (false);
grant select on public.audit_events to authenticated;

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
  member_role text;
  is_deleted boolean;
  payload_value jsonb;
  result jsonb := '[]'::jsonb;
  changed_count integer := 0;
  action_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select role into member_role
    from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid();

  if member_role is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) is distinct from 'array'
     or jsonb_array_length(p_changes) > 200 then
    raise exception 'invalid_batch';
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    entity := change->>'entity_type';
    if entity is null or entity not in (
      'product','party','invoice','invoice_line','stock_movement','party_ledger',
      'account','voucher','voucher_line','import_order','import_receipt',
      'import_receipt_line','product_valuation','treasury_entry','check'
    ) then
      raise exception 'invalid_entity_type';
    end if;

    if coalesce(member_role,'') not in ('owner','admin','accountant') then
      if member_role = 'viewer' then
        raise exception 'read_only_role' using errcode = '42501';
      elsif member_role = 'sales' and entity not in ('party','invoice','invoice_line') then
        raise exception 'role_not_allowed_for_entity' using errcode = '42501';
      elsif member_role = 'warehouse' and entity not in ('product','stock_movement','import_order','import_receipt','import_receipt_line','product_valuation') then
        raise exception 'role_not_allowed_for_entity' using errcode = '42501';
      elsif member_role not in ('sales','warehouse') then
        raise exception 'invalid_member_role' using errcode = '42501';
      end if;
    end if;

    if change->>'entity_id' is null then raise exception 'missing_entity_id'; end if;
    entity_uuid := (change->>'entity_id')::uuid;
    base := coalesce((change->>'base_version')::bigint, 0);
    if base < 0 then raise exception 'invalid_base_version'; end if;
    is_deleted := coalesce((change->>'deleted')::boolean,false);
    payload_value := coalesce(change->'payload','{}'::jsonb);
    if jsonb_typeof(payload_value) is distinct from 'object' then
      raise exception 'invalid_payload';
    end if;

    current_version := null;
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
      action_name := case when is_deleted then 'DELETE' else 'CREATE' end;
      insert into public.sync_records(
        organization_id, entity_type, entity_id, version, payload, deleted_at, updated_by, updated_at
      ) values (
        p_organization_id, entity, entity_uuid, next_version,
        payload_value,
        case when is_deleted then now() else null end,
        auth.uid(), now()
      );
    else
      if current_version <> base then
        raise exception 'sync_conflict:%,%,server_version=%', entity, entity_uuid, current_version using errcode = '40001';
      end if;
      next_version := current_version + 1;
      action_name := case when is_deleted then 'DELETE' else 'UPDATE' end;
      update public.sync_records set
        version = next_version,
        payload = case when is_deleted then payload else payload_value end,
        deleted_at = case when is_deleted then now() else null end,
        updated_by = auth.uid(),
        updated_at = now()
      where organization_id = p_organization_id
        and entity_type = entity and entity_id = entity_uuid;
    end if;

    insert into public.audit_events(
      organization_id, actor_id, action, entity_type, entity_id, previous_version, new_version
    ) values (
      p_organization_id, auth.uid(), action_name, entity, entity_uuid,
      case when current_version is null then null else current_version end,
      next_version
    );

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
