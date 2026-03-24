alter table public.companies
  add column if not exists subindustry text;

alter table public.companies
  add column if not exists notes text[] not null default '{}'::text[];
