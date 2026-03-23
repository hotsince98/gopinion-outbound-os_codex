# GoPinion Outbound OS Agent Guide

## Product Mission

Build a modular outbound operating system that helps GoPinion consistently book 5 appointments per day by identifying the right dealers, enriching them intelligently, running structured outreach, and improving from real outcomes over time.

## V1 Scope

Version 1 is for independent used car dealers in the U.S. and should include:

- Lead intake
- Company enrichment
- Contact enrichment
- Decision-maker inference
- Lead scoring
- Outreach sequencing
- Reply classification
- Booking handoff
- Insights and reporting
- Learning loops from outcomes

Use placeholder or mock integrations first when they reduce implementation risk. Build dealer-first now, while keeping the system extensible to future industries and offers.

## Architecture Rules

- Build for modularity, not hacks.
- Keep UI logic separate from business logic.
- Keep domain logic in reusable modules so it can support future industries and offers.
- Treat integrations as replaceable adapters, even when mocked.
- Keep prompts, agents, data models, and orchestration concerns separated.
- Prefer simple interfaces between modules over tightly coupled shortcuts.
- Decision-maker inference must return hypotheses with confidence, never false certainty.
- Optimize for clean composition so a premium dark dashboard can be layered on later without rewriting core logic.

Repository intent:

- `app/` is for app routes, pages, and composition.
- `components/` is for presentational UI building blocks.
- `lib/` is for business logic, services, utilities, and integration adapters.
- `agents/` is for agent workflows and orchestration definitions.
- `prompts/` is for reusable prompt assets and structured prompt templates.
- `db/` is for schema, migrations, and seed material.
- `docs/` is for product, system, and workflow documentation.
- `skills/` is for reusable operating procedures and Codex-compatible skills.
- `tests/` is for automated coverage.

## Product Rules

- Start with dealers first.
- Support multiple industries and offers later without rewriting the core system.
- Focus early workflows on Reviews / Reputation and NAPS.
- Every workflow should move the system toward more booked appointments, better targeting, or better learning.
- Prefer traceable, explainable outputs over black-box certainty.
- Do not ship fake confidence, especially around decision-makers, intent, or fit.
- Use mock data and placeholder integrations when they help define the product contract early.

## UX Rules

- Keep the interface minimal, clean, and operationally clear.
- Prioritize fast scanning, obvious next actions, and low operator friction.
- Separate data display from action controls.
- Show confidence, uncertainty, and missing data clearly.
- Do not overdesign v1.
- The premium dark dashboard can come later after the workflow foundations are solid.

## Data Rules

- Distinguish observed facts from inferred conclusions.
- Store confidence wherever the system makes a hypothesis.
- Preserve provenance so users can tell where lead or contact data came from.
- Design records so mocks can be replaced by real providers without breaking the product model.
- Track outcomes so outreach performance, appointment rates, and learning signals can improve future decisions.
- Avoid hidden state and silent mutation in core lead workflows.

## ICP Rules

Prioritize leads that match the dream customer profile:

- Independent used car dealer
- 11-25 cars sold per month
- Website present
- Google Business Profile present
- Google rating around 3.2-4.0
- 15-150 reviews
- Low or inconsistent review response
- Growth-oriented, pain-aware, or solution-aware
- Likely 38-52 years old
- Already uses at least 2 SaaS tools

Avoid prioritizing:

- No website and no Google Business Profile
- Under 5 cars sold per month
- Already locked into Birdeye or Podium
- 4.8+ stars with no visible pain
- Large franchise or corporate groups
- Highly tech-resistant or retiring operators

## Delivery Rules

- Keep every iteration minimal and clean.
- Do not implement extra app logic before the product contract is clear.
- Prefer small, composable slices over broad speculative systems.
- Write docs and structure first when they reduce rework later.
- Add tests when behavior exists.
- Avoid overbuilding, especially around integrations, UI polish, and automation breadth.

## Done Criteria

A change is done when:

- It supports the dealer-first v1 mission.
- It fits the modular architecture and keeps UI separate from business logic.
- It does not introduce fake certainty in inferred outputs.
- It is documented clearly enough for the next implementation step.
- It is minimal, clean, and ready to extend.
- Any new behavior is testable and placed in the right module boundary.
