# Product Spec

## Product Mission

GoPinion Outbound OS exists to help GoPinion book 5 appointments per day by running a disciplined, modular outbound system that finds the right dealers, enriches them intelligently, reaches out with the right offer, and learns from outcomes over time.

## What The Product Is

GoPinion Outbound OS is a modular outbound operating system for:

- finding and qualifying leads
- enriching companies and contacts
- inferring likely decision-makers
- scoring lead quality and offer fit
- running outreach sequences
- handling replies and booking intent
- capturing insights and improving future outbound decisions

The product should be built dealer-first, but with clean module boundaries so it can later support additional industries and offers without rewriting the core system.

## V1 Scope

Version 1 is focused on independent used car dealers in the U.S. and should support:

- lead intake
- company and contact enrichment
- decision-maker inference
- lead scoring
- outreach sequencing
- reply classification
- booking and basic pipeline tracking
- insights and learning from outcomes
- offer selection between Reviews / Reputation and NAPS

Mock or placeholder integrations are acceptable in v1 when they help define the workflow and module contracts without adding unnecessary complexity.

## Primary ICP

The primary ICP is the U.S. independent used car dealer, especially operators selling around 11-25 cars per month with an active website, a claimed Google Business Profile, visible review signals, and enough digital maturity to respond to a structured outbound process.

## Initial Offers

The first two offers are:

- Reviews / Reputation
- NAPS

Reviews / Reputation is the cleaner v1 front-door offer. NAPS should be supported as a second offer path once the core dealer qualification and outreach flow is working cleanly.

## Primary Goal

The primary operating goal is to book 5 appointments per day.

This means the product should optimize for:

- better lead selection
- better offer matching
- faster sequence execution
- cleaner reply handling
- clearer feedback loops on what is working

## Dashboard Modes

The product should eventually support two complementary dashboard modes.

### Operations Dashboard

The operations dashboard is the execution surface. It should make it easy to:

- review lead queues
- inspect enrichment results
- view confidence on decision-maker hypotheses
- see sequence status and reply state
- monitor appointments, pipeline health, and performance
- take clear next actions with minimal friction

### Graph / Node Command Center

The graph / node command center is the system orchestration surface. It should make it easy to:

- visualize how modules connect
- inspect workflow state across lead intake, enrichment, scoring, outreach, and learning
- understand what agents, prompts, and rules are contributing to outputs
- support future experimentation and workflow tuning

In v1, both modes can begin as simple functional surfaces. A premium dark dashboard treatment is not required yet.

## Core Modules

### Lead Intake

Accept leads from manual entry, CSV-style imports, or placeholder source adapters and normalize them into a common company record.

### Enrichment

Expand company and contact data with mock or real provider adapters, while preserving provenance and distinguishing facts from inferred data.

### Decision-Maker Inference

Generate hypotheses about likely owners, general managers, or other relevant operators, always with confidence and reasoning signals rather than false certainty.

### Lead Scoring

Rank leads based on ICP fit, pain signals, offer fit, and practical outreach readiness.

### Outreach Engine

Manage campaigns, sequences, enrollment state, messaging variants, and outbound execution with an email-first approach.

### Booking + Pipeline

Track positive replies, booking intent, scheduled appointments, and simple pipeline progression.

### Learning Layer

Capture outcome data, experiments, and recurring insights so the system can improve targeting, scoring, and offer selection over time.

### Offer Plug-In Layer

Represent offers as modular logic and messaging packages so Reviews / Reputation and NAPS can share the same outbound engine while preserving offer-specific fit rules and angles.

## V1 Boundaries

Version 1 should include:

- dealer-focused lead qualification
- practical, modular workflow support
- minimal but clear UI surfaces
- placeholder integrations where needed
- traceable outputs with confidence on inferred data

Version 1 is intentionally not in scope for:

- full multi-industry support
- a polished premium dark dashboard experience
- broad channel expansion beyond the initial email-first workflow
- deep production integrations across every provider category
- autonomous black-box decisioning without visible confidence or provenance
- overbuilt workflow automation that hides the core system behavior
