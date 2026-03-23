# Persistence Plan

## Goal

Prepare GoPinion Outbound OS to move from in-memory mock repositories to a Supabase/Postgres-backed persistence layer without forcing selectors or pages to know which backend is active.

The app should continue to use mock data by default until the Postgres implementation is ready.

## Current Audit

### What already existed

- Typed domain models under `lib/domain`
- Repository contracts in the data layer
- Mock repositories under `lib/data/mock`
- Selector-backed workspaces that keep shaping logic out of pages
- A storage mapping sketch in `db/schema/entities.ts`

### Main gaps before this refactor

- Selectors imported `mockDataAccess` directly, so the repository interface existed but the implementation choice still leaked into the read layer.
- There was no single runtime entry point that decided which backend to use.
- There was no obvious `postgres` implementation area in the data layer.
- `db/schema/entities.ts` had drifted behind the current domain model in a few places:
  - `Company` was missing `legalName`, `isIndependent`, `softwareToolCountEstimate`, and `buyingStage`
  - `Sequence` was missing `lineageKey` and `version`
  - `Reply` was missing `sentiment` and `bodyText`
  - `Appointment` was missing `confirmationStatus`

## Refactor Summary

### Repository boundary

The data layer now exposes a single runtime-selected entry point:

- `lib/data/core/contracts.ts`
  - Source of truth for repository and `DataAccess` interfaces
- `lib/data/access.ts`
  - Chooses the active backend from `DATA_BACKEND`
  - Defaults to `mock`
  - Exposes `getDataAccess()`
- `lib/data/mock/data-access.ts`
  - Exposes `createMockDataAccess()`
  - Still powers the app today
- `lib/data/postgres/data-access.ts`
  - Explicit placeholder for the future Postgres/Supabase implementation
  - Throws on use for now so we do not accidentally imply live support

Selectors now read through `getDataAccess()` instead of importing the mock implementation directly.

## Current Persistence Status

### First Supabase/Postgres tranche implemented

The app can now run in either mode:

- `DATA_BACKEND=mock`
  - Existing in-memory/config-backed behavior
- `DATA_BACKEND=postgres`
  - Supabase-backed repositories for:
    - `Company`
    - `Contact`
    - `Campaign`
    - `Reply`
    - `Appointment`
  - Mock/config-backed repositories still power:
    - `Offer`
    - `Sequence`
    - `Enrollment`
    - `Experiment`
    - `Insight`
    - `MemoryEntry`

### Runtime composition

- `lib/data/access.ts`
  - Chooses `mock` vs `postgres`
- `lib/data/postgres/client.ts`
  - Resolves server-only Supabase env and creates the admin client
- `lib/data/postgres/repositories/index.ts`
  - Implements the first DB-backed repositories
- `lib/data/postgres/mappers/index.ts`
  - Maps snake_case database rows into the domain models used by selectors/pages
- `lib/data/postgres/data-access.ts`
  - Composes a hybrid `DataAccess` object so selectors/pages stay unchanged

## Seeding and Empty-State Behavior

### Seed source of truth

The first seed path reuses the existing typed mock store:

- `lib/data/mock/store.ts`
  - Canonical typed seed records for the currently supported operational entities
- `lib/data/postgres/mappers/index.ts`
  - Translates those domain records into Postgres row payloads
- `lib/data/postgres/seed.ts`
  - Builds the seed payload and performs safe upserts
- `scripts/seed-supabase.ts`
  - CLI entry point

### What gets seeded

`npm run db:seed` currently upserts:

- `companies`
- `contacts`
- `campaigns`
- `replies`
- `appointments`

The seed runner uses `upsert` on `id`, so it is additive and repeatable.
It does not wipe tables or silently reset anything.

### How to run the seed

1. Apply the SQL migration for the core operational tables.
2. Set:
   - `DATA_BACKEND=postgres`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_SCHEMA=public`
3. Run:
   - `npm run db:seed`

### Empty Postgres behavior

When `DATA_BACKEND=postgres`:

- If the supported tables contain data, selectors/pages use that Postgres data.
- If the supported tables are empty, selectors/pages return empty collections and zero-valued summaries for those entities.
- The app does not silently swap those persisted entities back to mock records.

### Intentional hybrid behavior

The following entities still come from mock/config in Postgres mode by design:

- `Offer`
- `Sequence`
- `Enrollment`
- `Experiment`
- `Insight`
- `MemoryEntry`

That is not an empty-table fallback. It is the current repository coverage boundary.
This means an empty Postgres database will still show config-driven control-plane data and the remaining mock-backed entities, while companies/campaigns/replies/appointments stay empty until seeded or written for real.

## Folder Structure

```text
lib/data/
  access.ts
  core/
    contracts.ts
  mock/
    data-access.ts
    store.ts
  postgres/
    client.ts
    data-access.ts
    mappers/
      index.ts
    repositories/
      index.ts
  selectors/
    ...
```

### Intended responsibilities

- `core/contracts.ts`
  - Backend-agnostic repository interfaces
- `mock/`
  - In-memory repositories and seed-backed behavior
- `postgres/client.ts`
  - Future Supabase/Postgres client wiring
- `postgres/repositories/`
  - One repository implementation per entity or aggregate
- `postgres/mappers/`
  - Row-to-domain and domain-to-row translation helpers
- `selectors/`
  - Read-model assembly that should stay independent from backend choice

## Entity Storage Map

The canonical storage sketch lives in `db/schema/entities.ts`.

| Domain entity | Planned table | Notes |
| --- | --- | --- |
| `Company` | `companies` | Keep complex sub-objects like `location`, `presence`, `scoring`, and `source` as JSON initially. |
| `Contact` | `contacts` | Direct FK to `companies`. Confidence and source remain JSON-friendly. |
| `Offer` | `offers` | File-backed seed data today; ready for a future managed table if operators need persistence. |
| `Campaign` | `campaigns` | Core operational entity; should stay relational. |
| `Sequence` | `sequences` | `steps` stays JSON initially; `lineageKey` and `version` now accounted for. |
| `Enrollment` | `enrollments` | Main state machine row tying company/contact/campaign/sequence/offer together. |
| `Reply` | `replies` | Includes classification, optional sentiment, full body text, and review flags. |
| `Appointment` | `appointments` | Includes confirmation status and links back to enrollment and reply. |
| `Experiment` | `experiments` | Lightweight relational table with optional entity linkage. |
| `Insight` | `insights` | Good candidate for append-oriented writes with tags stored as arrays or JSON. |
| `MemoryEntry` | `memory_entries` | Durable notes, playbooks, and constraints. |
| `IcpProfile` | `icp_profiles` | Can remain config-backed initially, then move to table-backed persistence later if needed. |

### Config-backed control-plane data

These are still intentionally file-backed for now:

- ICP control-plane details in `lib/data/config/settings.ts`
- Offer seed configuration in `lib/data/config/offers.ts`
- Priority tiers and scoring buckets in `lib/data/config/priority-tiers.ts`
- Workflow, learning, and integration readiness settings in `lib/data/config/settings.ts`

Recommended approach:

1. Persist core operational entities first.
2. Keep control-plane config file-backed until operators truly need live edits.
3. Promote config tables later behind the same selector/repository boundary.

## First Migration Notes

The first SQL migration now lives at:

- `db/migrations/20260323_001_supabase_core_operational_entities.sql`

### What the migration covers

- Creates `companies`, `contacts`, `campaigns`, `replies`, and `appointments`
- Uses `text` primary keys to stay aligned with the current domain IDs like `company_*`
- Uses `jsonb` for nested domain structures that are still evolving:
  - `companies.location`
  - `companies.presence`
  - `companies.scoring`
  - `companies.source`
  - `contacts.confidence`
  - `contacts.source`
- Uses `text[]` for lightweight list fields
- Adds practical indexes for the first repository filters and operational views

### Intentional v1 compromises

- `offer_id`, `sequence_id`, and `enrollment_id` are stored as plain text references for now
  - those entities are still mock/config-backed in this tranche
- `primary_contact_id`, `active_campaign_ids`, and `appointment_ids` stay denormalized on `companies`
  - this preserves parity with the current domain model and keeps the first migration practical
- Only the `public` schema is supported in the first Supabase implementation

## Postgres Implementation Path

### Phase 1: Schema and migrations

1. Translate `db/schema/entities.ts` into SQL migrations.
2. Decide which fields stay JSON in v1 versus normalized child tables.
3. Create local and hosted migration flow for Supabase/Postgres.

Status:

- Complete for the first five operational entities

### Phase 2: Client and repository implementation

1. Implement a server-safe Postgres/Supabase client in `lib/data/postgres/client.ts`.
2. Add repository modules under `lib/data/postgres/repositories/`.
3. Add row/domain mappers under `lib/data/postgres/mappers/`.
4. Compose those repositories in `lib/data/postgres/data-access.ts`.

Status:

- Complete for the first five operational entities

### Phase 3: Backend activation

1. Keep `DATA_BACKEND=mock` as the default.
2. Enable `DATA_BACKEND=postgres` only after repository coverage exists.
3. Run the full app with selectors unchanged and pages untouched.
4. Validate parity against the mock-backed workspaces.
5. Migrate the remaining entities only when their write/read paths justify it.

## Practical Notes

- The app intentionally still boots on mock data.
- No live Supabase credentials are checked into the repo.
- The Postgres path now uses Supabase when explicitly enabled via env.
- Because only the first five entities are DB-backed, Postgres mode is intentionally hybrid for now.
- Campaigns, replies, and appointments should continue referencing the seeded offer/sequence/enrollment IDs until those entities are promoted into persistence.
- Because selectors now read through a single data-access boundary, the implementation swap is localized to the data layer instead of spread across workspace pages.
