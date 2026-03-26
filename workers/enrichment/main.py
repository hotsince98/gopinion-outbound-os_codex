from __future__ import annotations

import json
import sys

try:
    from .models import WorkerOutput
    from .models import WorkerRequest
    from .scrapling_client import crawl_company_website
except ImportError:
    from models import WorkerOutput
    from models import WorkerRequest
    from scrapling_client import crawl_company_website


def parse_request(raw_payload: str) -> WorkerRequest:
    payload = json.loads(raw_payload or "{}")
    website = payload.get("website")
    preferred_page_urls = payload.get("preferred_page_urls") or []
    likely_page_paths = payload.get("likely_page_paths") or []
    timeout_seconds = payload.get("timeout_seconds") or 12.0
    max_pages = payload.get("max_pages") or 10
    if not isinstance(preferred_page_urls, list) or not isinstance(likely_page_paths, list):
        raise ValueError("preferred_page_urls and likely_page_paths must be arrays.")
    return WorkerRequest(
        website=website,
        preferred_page_urls=[str(value) for value in preferred_page_urls],
        likely_page_paths=[str(value) for value in likely_page_paths],
        timeout_seconds=float(timeout_seconds),
        max_pages=int(max_pages),
    )


def main() -> int:
    try:
        raw_payload = sys.stdin.read()
        request = parse_request(raw_payload)
        result = crawl_company_website(request)
        sys.stdout.write(json.dumps(result.to_dict()))
        return 0
    except Exception as error:  # noqa: BLE001
        failure = WorkerOutput(errors=[str(error)])
        sys.stdout.write(json.dumps(failure.to_dict()))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
