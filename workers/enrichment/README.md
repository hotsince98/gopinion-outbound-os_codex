# Scrapling Enrichment Worker

This worker gives GoPinion Outbound OS an optional Python-based website enrichment path.

When `ENRICHMENT_PROVIDER=scrapling`, the app still runs its normal TypeScript website discovery step, then hands the selected website to `workers/enrichment/main.py` over stdin as JSON. The worker returns structured JSON on stdout, and the app maps that result back into the existing enrichment pipeline. If Python, Scrapling, or the worker is unavailable, the app falls back to the built-in `basic` enrichment provider without crashing the queue.

## Files

- `main.py`
  Receives JSON over stdin and prints structured JSON to stdout.
- `scrapling_client.py`
  Handles page fetching and crawl orchestration with Scrapling.
- `extractors.py`
  Contains contact, people, phone, and clue extraction helpers.
- `models.py`
  Shared request and output dataclasses.

## Python Version

Use Python `3.10+`.

## Install Locally

1. Create and activate a virtual environment.
2. Install the worker dependencies:

```bash
python3 -m pip install -r workers/enrichment/requirements.txt
```

3. Install the Scrapling fetcher/browser dependencies:

```bash
scrapling install
```

## App Configuration

Set these environment variables in the app:

```bash
ENRICHMENT_PROVIDER=scrapling
SCRAPLING_PYTHON_BIN=python3
SCRAPLING_WORKER_ENTRY=workers/enrichment/main.py
SCRAPLING_WORKER_TIMEOUT_MS=20000
```

To disable the worker at any time:

```bash
ENRICHMENT_PROVIDER=basic
```

## Manual Smoke Test

```bash
printf '{"website":"https://example.com","preferred_page_urls":["https://example.com/contact"]}' | python3 workers/enrichment/main.py
```

Expected output shape:

```json
{
  "website_used": "https://example.com",
  "pages_crawled": [],
  "emails_found": [],
  "phones_found": [],
  "people_found": [],
  "role_inbox_clues": [],
  "contact_form_urls": [],
  "source_evidence": [],
  "confidence_hints": [],
  "warnings": [],
  "errors": [],
  "category_clues": [],
  "external_presence_hints": [],
  "description_snippet": null
}
```

## What The Worker Extracts

The current worker focuses on:

- homepage fetch
- likely contact/about/team/staff pages
- emails
- phones
- named people and titles
- role inboxes
- contact-form clues
- category and public-presence hints

The TypeScript app still owns official-site discovery, contact ranking, readiness logic, and persistence.
