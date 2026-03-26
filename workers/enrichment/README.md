# Scrapling Enrichment Worker

This worker gives GoPinion Outbound OS an optional Python-based website enrichment path.

When `ENRICHMENT_PROVIDER=scrapling`, the app still runs its normal TypeScript website discovery step, then hands the selected website to the Scrapling worker. In local development, the app can spawn `workers/enrichment/main.py` over stdin as JSON. In production on Vercel, the app should call the bundled Python function at `api/enrichment/scrapling.py`, which reuses the same worker code. If Python, Scrapling, or the worker is unavailable, the app falls back to the built-in `basic` enrichment provider without crashing the queue.

## Files

- `main.py`
  Receives JSON over stdin and prints structured JSON to stdout.
- `../../api/enrichment/scrapling.py`
  Vercel Python function entry point for production HTTP execution.
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
SCRAPLING_WORKER_TRANSPORT=auto
SCRAPLING_WORKER_ENDPOINT=/api/enrichment/scrapling
SCRAPLING_WORKER_ORIGIN=http://localhost:3000
SCRAPLING_PYTHON_BIN=python3
SCRAPLING_WORKER_ENTRY=workers/enrichment/main.py
SCRAPLING_WORKER_TIMEOUT_MS=20000
```

Transport notes:

- `SCRAPLING_WORKER_TRANSPORT=auto`
  Uses the local spawned Python process outside Vercel, and the HTTP Python function on Vercel.
- `SCRAPLING_WORKER_TRANSPORT=process`
  Forces local child-process execution through `main.py`.
- `SCRAPLING_WORKER_TRANSPORT=http`
  Forces HTTP execution through the Python function endpoint.

For Vercel production:

- keep `ENRICHMENT_PROVIDER=scrapling`
- leave `SCRAPLING_WORKER_TRANSPORT=auto` or set it to `http`
- set `APP_URL` to your production app URL if you do not want to rely on `VERCEL_URL`
- keep the root `requirements.txt` file committed as a flat file so Vercel installs `scrapling[fetchers]` for the Python function
- keep `workers/enrichment/requirements.txt` in sync with the root file for local worker installs

To disable the worker at any time:

```bash
ENRICHMENT_PROVIDER=basic
```

## Manual Smoke Test

```bash
printf '{"website":"https://example.com","preferred_page_urls":["https://example.com/contact"]}' | python3 workers/enrichment/main.py
```

Production HTTP smoke test once the app is running:

```bash
curl -X POST "$APP_URL/api/enrichment/scrapling" \
  -H "content-type: application/json" \
  -d '{"website":"https://example.com","preferred_page_urls":["https://example.com/contact"]}'
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
