-- Campaign assignment and enrollment persistence.
-- This migration adds the first real enrollments table so campaign assignment
-- can write through the Supabase/Postgres-backed repository boundary.
-- Offers and sequences are still config/mock-backed, so those IDs remain text
-- references instead of foreign keys for now.

create table if not exists public.enrollments (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  sequence_id text not null,
  offer_id text not null,
  priority_tier text not null check (
    priority_tier in ('tier_1', 'tier_2', 'tier_3')
  ),
  state text not null check (
    state in ('pending', 'active', 'waiting', 'replied', 'booked', 'completed', 'paused', 'failed')
  ),
  current_step_index integer not null default 0,
  entered_sequence_at timestamptz not null,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  last_reply_id text,
  appointment_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists enrollments_company_id_idx
  on public.enrollments (company_id);

create index if not exists enrollments_campaign_id_idx
  on public.enrollments (campaign_id);

create index if not exists enrollments_sequence_id_idx
  on public.enrollments (sequence_id);

create index if not exists enrollments_state_idx
  on public.enrollments (state);

create index if not exists enrollments_next_action_at_idx
  on public.enrollments (next_action_at);
