-- OPTIONAL DEPLOYMENT REFERENCE ONLY.
-- This migration is NOT wired into the current localStorage-based application.
-- Review with a database/security owner before applying to any shared environment.

create extension if not exists pgcrypto;

create table if not exists public.waterchain_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  source_kind text not null check (source_kind in ('borehole','tap','spring','well','water_vendor','household','other')),
  source_identifier text not null check (length(trim(source_identifier)) between 1 and 240),
  location_label text,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create unique index if not exists waterchain_source_identifier_unique_per_owner
  on public.waterchain_sources (owner_id, lower(trim(source_identifier)));

create table if not exists public.waterchain_investigations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  status text not null default 'open' check (status in ('open','under_review','closed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.waterchain_journeys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null,
  source_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  status text not null default 'intake' check (status in ('intake','sampling','evidence_review','assessment','follow_up','closed')),
  closeout_note text,
  started_at timestamptz,
  household_or_site_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (investigation_id, owner_id) references public.waterchain_investigations(id, owner_id) on delete cascade,
  foreign key (source_id, owner_id) references public.waterchain_sources(id, owner_id) on delete restrict,
  check (status <> 'closed' or length(trim(coalesce(closeout_note,''))) > 0)
);

create table if not exists public.waterchain_evidence_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null,
  record_code text not null check (length(trim(record_code)) between 1 and 160),
  sample_code text not null check (length(trim(sample_code)) between 1 and 160),
  stage text not null check (stage in ('source','collection','storage','serving')),
  collected_at timestamptz,
  water_source_id text,
  batch_id text,
  analyte text not null check (analyte in ('e_coli_presence','e_coli_concentration','turbidity','free_chlorine','other')),
  result text not null check (result in ('detected','not_detected','quantified','not_tested','invalid')),
  numeric_value numeric,
  unit text,
  method text,
  lab_name text,
  positive_control text not null check (positive_control in ('pass','fail','not_recorded')),
  negative_control text not null check (negative_control in ('pass','fail','not_recorded')),
  blank_control text not null check (blank_control in ('pass','fail','not_recorded')),
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (investigation_id, owner_id) references public.waterchain_investigations(id, owner_id) on delete cascade,
  check (numeric_value is null or numeric_value >= 0),
  check (result <> 'quantified' or (numeric_value is not null and length(trim(coalesce(unit,''))) > 0))
);
create unique index if not exists waterchain_evidence_record_code_unique_per_investigation
  on public.waterchain_evidence_records (investigation_id, lower(trim(record_code)));
create index if not exists waterchain_evidence_investigation_stage_idx
  on public.waterchain_evidence_records (investigation_id, stage, collected_at);

create table if not exists public.waterchain_sampling_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid not null,
  evidence_record_id uuid not null,
  stage text not null check (stage in ('source','collection','storage','serving')),
  sampled_at timestamptz,
  water_entity_ref text not null check (length(trim(water_entity_ref)) between 1 and 240),
  relationship_basis text not null check (relationship_basis in ('directly_documented','associated_visit','self_reported','unconfirmed')),
  relationship_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (journey_id, evidence_record_id),
  foreign key (journey_id, owner_id) references public.waterchain_journeys(id, owner_id) on delete cascade,
  foreign key (evidence_record_id, owner_id) references public.waterchain_evidence_records(id, owner_id) on delete restrict
);

create table if not exists public.waterchain_transfer_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid not null,
  from_stage text not null check (from_stage in ('source','collection','storage')),
  to_stage text not null check (to_stage in ('collection','storage','serving')),
  transfer_kind text not null check (transfer_kind in ('collection','container_transfer','refill','decanting','serving','other')),
  from_entity_ref text not null check (length(trim(from_entity_ref)) between 1 and 240),
  to_entity_ref text not null check (length(trim(to_entity_ref)) between 1 and 240),
  occurred_at timestamptz,
  evidence_basis text not null check (evidence_basis in ('documented','observed','self_reported','inferred','unverified')),
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (journey_id, owner_id) references public.waterchain_journeys(id, owner_id) on delete cascade,
  check ((from_stage = 'source' and to_stage = 'collection') or
         (from_stage = 'collection' and to_stage = 'storage') or
         (from_stage = 'storage' and to_stage = 'serving')),
  check (evidence_basis <> 'documented' or length(trim(coalesce(source_reference,''))) > 0),
  check (evidence_basis <> 'observed' or length(trim(coalesce(source_reference,''))) > 0 or length(trim(coalesce(notes,''))) > 0)
);

create table if not exists public.waterchain_provenance_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid,
  evidence_record_id uuid,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  artifact_kind text not null check (artifact_kind in ('laboratory_report','field_note','chain_of_custody','sample_photo','calibration_record','other')),
  byte_length bigint not null check (byte_length >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  content_storage text not null default 'external_reference_only' check (content_storage in ('browser_local','external_reference_only')),
  source_reference text,
  verification_status text not null default 'unreviewed' check (verification_status in ('unreviewed','reviewed_against_original','independently_checked')),
  note text,
  recorded_at timestamptz not null default now(),
  foreign key (journey_id, owner_id) references public.waterchain_journeys(id, owner_id) on delete cascade,
  foreign key (evidence_record_id, owner_id) references public.waterchain_evidence_records(id, owner_id) on delete restrict,
  check (journey_id is not null or evidence_record_id is not null)
);

create table if not exists public.waterchain_audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now(),
  unique (owner_id, event_hash)
  -- journey_id intentionally has no foreign key: append-only historical audit
  -- entries must survive journey deletion, while owner_id remains required.
);

-- Owner-scoped row-level security. Every child row repeats owner_id and uses
-- composite foreign keys above to prevent cross-owner references.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'waterchain_sources','waterchain_investigations','waterchain_journeys',
    'waterchain_evidence_records','waterchain_sampling_events','waterchain_transfer_events',
    'waterchain_provenance_artifacts','waterchain_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_owner_select', tbl);
    execute format('create policy %I on public.%I for select using (owner_id = auth.uid())', tbl || '_owner_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_owner_insert', tbl);
    execute format('create policy %I on public.%I for insert with check (owner_id = auth.uid())', tbl || '_owner_insert', tbl);
  end loop;
end $$;

-- Mutable domain tables: owner-scoped updates/deletes.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'waterchain_sources','waterchain_investigations','waterchain_journeys',
    'waterchain_evidence_records','waterchain_sampling_events','waterchain_transfer_events',
    'waterchain_provenance_artifacts'
  ] loop
    execute format('drop policy if exists %I on public.%I', tbl || '_owner_update', tbl);
    execute format('create policy %I on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', tbl || '_owner_update', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_owner_delete', tbl);
    execute format('create policy %I on public.%I for delete using (owner_id = auth.uid())', tbl || '_owner_delete', tbl);
  end loop;
end $$;

-- Tighten audit inserts: a client may not write an arbitrary actor_user_id.
drop policy if exists waterchain_audit_events_owner_insert on public.waterchain_audit_events;
create policy waterchain_audit_events_owner_insert on public.waterchain_audit_events
  for insert with check (owner_id = auth.uid() and (actor_user_id is null or actor_user_id = auth.uid()));

-- Audit rows are append-only via the application policy surface: no UPDATE or
-- DELETE policies are created. A database owner/service role can still bypass
-- RLS; production deployments need restricted service credentials and backups.
comment on table public.waterchain_provenance_artifacts is 'Stores file hashes/metadata only; file bytes are not included.';
comment on table public.waterchain_audit_events is 'Owner-scoped append-only audit event records; hashes are not a digital signature.';
