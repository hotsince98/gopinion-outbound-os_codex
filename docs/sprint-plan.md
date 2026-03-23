# Sprint Plan

## Planning Principles

- keep each sprint practical and minimal
- preserve clean boundaries between UI, business logic, data, agents, and prompts
- use mock adapters first where real integrations would slow down learning
- prioritize the shortest path to a reliable booking workflow

## Sprint 1: Foundation

### Objective

Establish the base project structure, core documentation, and initial domain contracts so implementation can begin cleanly.

### Main Tasks

- finalize planning docs and repo conventions
- define initial core entities and module boundaries
- outline adapter interfaces for external services
- decide the first minimal app shell shape without implementing full app logic

### Deliverables

- populated docs set
- agreed entity list and module map
- initial architecture direction aligned with `AGENTS.md`

### Dependencies

- none beyond current repo scaffold

## Sprint 2: Lead Intake + Enrichment Skeleton

### Objective

Create the first working path from raw lead input to enriched company and contact records using placeholder integrations where needed.

### Main Tasks

- implement lead intake contracts and normalization rules
- create company and contact data models
- add mock enrichment adapters
- store provenance and distinguish observed vs inferred data

### Deliverables

- lead intake skeleton
- company and contact persistence model
- enrichment service interfaces plus mock implementations

### Dependencies

- Sprint 1 entity and architecture decisions

## Sprint 3: Decision-Maker Inference

### Objective

Generate structured hypotheses about likely decision-makers and expose confidence in a practical, traceable way.

### Main Tasks

- define inference inputs and outputs
- build decision-maker hypothesis logic
- attach confidence and supporting signals
- connect outputs back to company and contact records

### Deliverables

- decision-maker inference module
- confidence-aware contact hypothesis model
- visible reasoning signals for operator review

### Dependencies

- Sprint 2 company, contact, and enrichment foundation

## Sprint 4: Campaign And Sequence Engine

### Objective

Create the first outbound execution layer for email-first campaigns and sequences.

### Main Tasks

- define offers, campaigns, sequences, and enrollments
- implement basic lead scoring and offer routing hooks
- create sequence progression rules
- wire mock outbound delivery adapters

### Deliverables

- campaign and sequence domain model
- enrollment tracking
- basic email-first outreach engine skeleton

### Dependencies

- Sprint 2 enrichment outputs
- Sprint 3 decision-maker inference

## Sprint 5: Reply Handling + Booking

### Objective

Turn outbound responses into usable pipeline actions and booked appointments.

### Main Tasks

- define reply capture and classification states
- connect positive replies to booking workflows
- create appointment and basic pipeline records
- support operator visibility into reply and booking status

### Deliverables

- reply model and classification flow
- booking workflow skeleton
- appointment tracking and simple pipeline linkage

### Dependencies

- Sprint 4 campaign and sequence engine

## Sprint 6: Analytics + Learning

### Objective

Capture what is working, what is failing, and what the system should remember for future outbound improvements.

### Main Tasks

- define experiments, insights, and memory entries
- record campaign, reply, and appointment outcomes
- create the first analytics summaries for operators
- feed insights back into scoring and offer selection logic

### Deliverables

- learning-layer data models
- basic performance and insight outputs
- experiment and memory entry structures

### Dependencies

- Sprint 5 reply and appointment outcomes

## Sprint 7: NAPS Support

### Objective

Add NAPS as a structured second offer path without breaking the Reviews-first outbound foundation.

### Main Tasks

- define NAPS fit signals and messaging guidance
- add NAPS offer configuration and routing support
- support NAPS-specific CTA and pricing references
- verify the offer plug-in layer handles multiple offers cleanly

### Deliverables

- NAPS offer module support
- multi-offer routing readiness
- validated offer plug-in approach for Reviews and NAPS

### Dependencies

- Sprint 4 outreach engine
- Sprint 6 learning and insights support
