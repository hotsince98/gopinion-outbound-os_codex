# Architecture

## Architecture Goal

The system should be modular, practical, and easy to extend. V1 should separate UI, business logic, data access, agents, and prompt/config concerns so we can move quickly without creating a tangled outbound stack.

## Major Modules And Responsibilities

### Lead Intake

- accepts raw company leads from manual entry, file import, or placeholder source adapters
- normalizes leads into a common company shape
- captures source and provenance

### Enrichment

- enriches company and contact records
- stores observed facts separately from inferred data
- supports mock adapters first, with real providers swapped in later

### Decision-Maker Inference

- evaluates likely owners, operators, or GMs
- outputs hypotheses with confidence
- records supporting signals for review

### Lead Scoring

- scores ICP fit, pain signals, and offer fit
- helps prioritize who should enter campaigns first
- stays explainable rather than opaque

### Outreach Engine

- manages campaigns, sequences, message variants, and enrollments
- tracks outbound state and progression
- starts with an email-first delivery model

### Reply Handling

- captures replies
- classifies response state
- routes positive intent toward booking or follow-up actions

### Booking + Pipeline

- creates appointments
- tracks basic pipeline state after positive response
- keeps booked outcomes tied back to the original lead and campaign

### Learning Layer

- records experiments, insights, and outcome trends
- feeds lessons back into scoring, targeting, offer selection, and messaging

### Offer Plug-In Layer

- represents offer-specific rules, fit signals, messaging angles, and CTA guidance
- allows Reviews / Reputation and NAPS to share common outbound infrastructure

## Suggested Data Flow

The expected v1 flow is:

1. Lead intake creates or imports a company record.
2. Enrichment adds company facts and likely contact candidates.
3. Decision-maker inference produces one or more contact hypotheses with confidence.
4. Lead scoring ranks the account based on ICP fit, pain, and offer fit.
5. Offer selection chooses the best initial offer path.
6. Outreach engine enrolls the lead into a campaign and sequence.
7. Replies are captured and classified.
8. Positive replies create booking actions and appointments.
9. Appointment and campaign outcomes feed experiments, insights, and memory entries.
10. Learning signals improve future targeting, messaging, and offer selection.

## Core Entities

### companies

The canonical organization record for a dealer. Holds normalized firmographic data, public presence signals, ICP indicators, and provenance.

### contacts

Potential decision-makers or relevant people tied to a company. Contacts may be observed or inferred and should store confidence where needed.

### offers

Offer definitions such as Reviews / Reputation and NAPS, including fit rules, positioning notes, CTA guidance, and later pricing/config.

### campaigns

Outbound campaign containers that define the targeting and operational goal for a cohort of leads.

### sequences

Ordered outreach steps, timing rules, and message variants used by campaigns.

### enrollments

The state record for a company or contact moving through a sequence.

### replies

Inbound response records and classification outputs tied to campaigns, sequences, and contacts.

### appointments

Booked meetings or confirmed appointment outcomes tied to the lead journey.

### experiments

Structured tests across ICP segments, offers, messaging, or sequence variants.

### insights

Human-readable or system-generated observations about what is working and what is not.

### memory_entries

Persistent learning notes or machine-usable summaries that future modules can reference.

## Separation Of Concerns

### UI

- lives in `app/` and `components/`
- responsible for views, navigation, state presentation, and operator actions
- should not contain core outbound rules or data enrichment logic

### Business Logic

- lives primarily in `lib/`
- contains lead qualification, enrichment orchestration, scoring, offer logic, and workflow rules
- should stay reusable across different UI surfaces

### Data Layer

- lives primarily in `db/` plus data-access modules in `lib/`
- owns schemas, persistence models, migrations, and repository-style access patterns
- should separate raw storage from domain behavior

### Agent Logic

- lives in `agents/`
- handles agent workflows, orchestration steps, and decision support behavior
- should call into business logic rather than replace it

### Prompts / Config

- lives in `prompts/`
- stores reusable prompt assets, configuration payloads, and structured messaging templates
- should remain versionable and separate from code execution paths

## External Integrations

External integrations should begin as mock adapters or placeholders where needed.

This applies especially to:

- enrichment providers
- email providers
- calendar providers
- CRM or pipeline sync providers
- analytics or reporting providers

Starting with adapter interfaces and mock implementations keeps the system testable, modular, and aligned with the current repo scope.

## Dashboard Surfaces

The architecture should support two UI surfaces without coupling logic to one view:

- an operations dashboard for daily execution
- a graph / node command center for workflow visibility and orchestration

Both should read from the same underlying business and data layers.
