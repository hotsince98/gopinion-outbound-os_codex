-- First persistence tranche for GoPinion Outbound OS.
-- This migration intentionally covers only the first operational entities:
-- companies, contacts, campaigns, replies, and appointments.
-- Offers, sequences, enrollments, insights, experiments, and memory entries
-- remain file/mock-backed for now and are referenced by ID only where needed.

create table if not exists public.companies (
  id text primary key,
  name text not null,
  legal_name text,
  industry_key text not null,
  icp_profile_id text not null,
  status text not null check (
    status in ('new', 'enriched', 'qualified', 'campaign_ready', 'customer', 'disqualified')
  ),
  priority_tier text not null check (
    priority_tier in ('tier_1', 'tier_2', 'tier_3')
  ),
  is_independent boolean not null,
  location jsonb not null,
  presence jsonb not null,
  monthly_cars_sold_range jsonb,
  likely_operator_age_range jsonb,
  software_tool_count_estimate integer,
  buying_stage text not null check (
    buying_stage in ('growth_oriented', 'pain_aware', 'solution_aware', 'pragmatic', 'unknown')
  ),
  pain_signals text[] not null default '{}'::text[],
  disqualifier_signals text[] not null default '{}'::text[],
  recommended_offer_ids text[] not null default '{}'::text[],
  primary_contact_id text,
  active_campaign_ids text[] not null default '{}'::text[],
  appointment_ids text[] not null default '{}'::text[],
  scoring jsonb not null,
  source jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contacts (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  full_name text,
  title text,
  role text not null check (
    role in ('owner', 'operator_owner', 'general_manager', 'dealership_manager', 'sales_manager', 'unknown')
  ),
  email text,
  phone text,
  linkedin_url text,
  source_kind text not null check (
    source_kind in ('observed', 'inferred')
  ),
  status text not null check (
    status in ('candidate', 'verified', 'invalid', 'do_not_contact')
  ),
  is_primary boolean not null default false,
  outreach_ready boolean not null default false,
  confidence jsonb not null,
  notes text[] not null default '{}'::text[],
  source jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaigns (
  id text primary key,
  name text not null,
  description text not null,
  status text not null check (
    status in ('draft', 'active', 'paused', 'completed', 'archived')
  ),
  offer_id text not null,
  primary_icp_profile_id text not null,
  target_tier text not null check (
    target_tier in ('tier_1', 'tier_2', 'tier_3')
  ),
  sequence_id text not null,
  channel text not null check (
    channel in ('email')
  ),
  objective text not null,
  goal_metric text not null check (
    goal_metric in ('appointments_booked')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.replies (
  id text primary key,
  enrollment_id text not null,
  company_id text not null references public.companies (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  offer_id text not null,
  channel text not null check (
    channel in ('email')
  ),
  classification text not null check (
    classification in (
      'positive',
      'objection',
      'not_now',
      'not_interested',
      'wrong_person',
      'out_of_office',
      'bounced',
      'unsubscribe',
      'unknown'
    )
  ),
  sentiment text check (
    sentiment in ('positive', 'neutral', 'mixed', 'negative')
  ),
  snippet text not null,
  body_text text not null,
  received_at timestamptz not null,
  requires_human_review boolean not null default false,
  indicates_booking_intent boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  enrollment_id text not null,
  reply_id text not null references public.replies (id) on delete cascade,
  status text not null check (
    status in ('proposed', 'scheduled', 'completed', 'canceled', 'no_show')
  ),
  confirmation_status text not null check (
    confirmation_status in ('pending', 'confirmed', 'risk_flagged')
  ),
  booked_at timestamptz not null,
  scheduled_for timestamptz not null,
  timezone text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists companies_priority_tier_idx
  on public.companies (priority_tier);

create index if not exists companies_status_idx
  on public.companies (status);

create index if not exists contacts_company_id_idx
  on public.contacts (company_id);

create index if not exists contacts_status_idx
  on public.contacts (status);

create index if not exists campaigns_status_idx
  on public.campaigns (status);

create index if not exists campaigns_offer_id_idx
  on public.campaigns (offer_id);

create index if not exists replies_classification_idx
  on public.replies (classification);

create index if not exists replies_enrollment_id_idx
  on public.replies (enrollment_id);

create index if not exists replies_campaign_id_idx
  on public.replies (campaign_id);

create index if not exists appointments_campaign_id_idx
  on public.appointments (campaign_id);

create index if not exists appointments_scheduled_for_idx
  on public.appointments (scheduled_for);
