from __future__ import annotations

from urllib.parse import urljoin
from urllib.parse import urlparse

from scrapling.fetchers import Fetcher

try:
    from .extractors import build_confidence_hints
    from .extractors import classify_page_kind
    from .extractors import dedupe_strings
    from .extractors import extract_category_clues
    from .extractors import extract_emails
    from .extractors import extract_external_presence_hints
    from .extractors import extract_named_people
    from .extractors import extract_phones
    from .extractors import extract_role_inboxes
    from .extractors import normalize_text_lines
    from .models import PageCrawlResult
    from .models import WorkerOutput
    from .models import WorkerRequest
except ImportError:
    from extractors import build_confidence_hints
    from extractors import classify_page_kind
    from extractors import dedupe_strings
    from extractors import extract_category_clues
    from extractors import extract_emails
    from extractors import extract_external_presence_hints
    from extractors import extract_named_people
    from extractors import extract_phones
    from extractors import extract_role_inboxes
    from extractors import normalize_text_lines
    from models import PageCrawlResult
    from models import WorkerOutput
    from models import WorkerRequest


def normalize_website(url: str | None) -> str | None:
    if not url:
        return None
    candidate = url.strip()
    if not candidate:
        return None
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if not parsed.hostname:
        return None
    path = parsed.path.rstrip("/")
    suffix = path if path else ""
    return f"{parsed.scheme}://{parsed.netloc.lower()}{suffix}"


def resolve_internal_url(base_url: str, href: str | None) -> str | None:
    if not href:
        return None
    candidate = href.strip()
    if not candidate or candidate.startswith("#") or candidate.startswith("mailto:"):
        return None
    try:
        resolved = urljoin(base_url, candidate)
        parsed = urlparse(resolved)
        base = urlparse(base_url)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.hostname != base.hostname:
        return None
    suffix = parsed.path.rstrip("/")
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme}://{parsed.netloc.lower()}{suffix}{query}"


def resolve_public_url(base_url: str, href: str | None) -> str | None:
    if not href:
        return None
    candidate = href.strip()
    if not candidate or candidate.startswith("#") or candidate.startswith("mailto:"):
        return None
    try:
        resolved = urljoin(base_url, candidate)
        parsed = urlparse(resolved)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    suffix = parsed.path.rstrip("/")
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme}://{parsed.netloc.lower()}{suffix}{query}"


def fetch_page(url: str):
    return Fetcher.get(url)


def build_candidate_urls(
    homepage_url: str,
    preferred_urls: list[str],
    likely_page_paths: list[str],
    homepage_links: list[str],
    max_pages: int,
) -> list[str]:
    candidates = [homepage_url]
    for href in preferred_urls:
        resolved = resolve_internal_url(homepage_url, href)
        if resolved:
            candidates.append(resolved)
    for path in likely_page_paths:
        resolved = resolve_internal_url(homepage_url, path)
        if resolved:
            candidates.append(resolved)
    for href in homepage_links:
        resolved = resolve_internal_url(homepage_url, href)
        if not resolved:
            continue
        kind = classify_page_kind(resolved)
        if kind in {"contact", "about", "team", "staff"}:
            candidates.append(resolved)
    deduped = dedupe_strings(candidates)
    return deduped[: max(max_pages, 1)]


def crawl_company_website(request: WorkerRequest) -> WorkerOutput:
    normalized_website = normalize_website(request.website)
    output = WorkerOutput(website_used=normalized_website)

    if not normalized_website:
        output.errors.append("No valid website was supplied to the Scrapling worker.")
        return output

    homepage_links: list[str] = []
    page_candidates = build_candidate_urls(
        homepage_url=normalized_website,
        preferred_urls=request.preferred_page_urls,
        likely_page_paths=request.likely_page_paths,
        homepage_links=[],
        max_pages=request.max_pages,
    )

    for url in page_candidates:
        kind = classify_page_kind(url)
        try:
            page = fetch_page(url)
            text_nodes = normalize_text_lines(page.css("body ::text").getall())
            body_text = "\n".join(text_nodes)
            title = page.css("title::text").get()
            description = page.css('meta[name="description"]::attr(content)').get()
            links = [link for link in page.css("a::attr(href)").getall() if link]
            forms = [action for action in page.css("form::attr(action)").getall() if action]
            resolved_forms = [
                resolved
                for resolved in (
                    resolve_internal_url(url, form_action) for form_action in forms
                )
                if resolved
            ]

            output.pages_crawled.append(
                PageCrawlResult(
                    url=url,
                    page_kind=kind,
                    status="fetched",
                    title=title,
                    contact_form_detected=bool(resolved_forms),
                )
            )
            output.emails_found.extend(extract_emails(body_text))
            output.phones_found.extend(extract_phones(body_text))
            output.people_found.extend(extract_named_people(text_nodes, url))
            output.contact_form_urls.extend(resolved_forms)
            output.category_clues.extend(
                extract_category_clues("\n".join([title or "", description or "", body_text]))
            )
            output.description_snippet = (
                output.description_snippet
                or description
                or next((line for line in text_nodes if len(line) > 40), None)
            )
            output.external_presence_hints.extend(
                extract_external_presence_hints(
                    [
                        resolved
                        for resolved in (resolve_public_url(url, href) for href in links)
                        if resolved
                    ]
                )
            )
            if kind == "homepage":
                homepage_links = links
        except Exception as error:  # noqa: BLE001
            output.pages_crawled.append(
                PageCrawlResult(
                    url=url,
                    page_kind=kind,
                    status="failed",
                    error=str(error),
                )
            )
            output.warnings.append(f"Failed to fetch {url}: {error}")

    if homepage_links:
        second_pass = build_candidate_urls(
            homepage_url=normalized_website,
            preferred_urls=request.preferred_page_urls,
            likely_page_paths=request.likely_page_paths,
            homepage_links=homepage_links,
            max_pages=request.max_pages,
        )
        visited = {page.url for page in output.pages_crawled}
        for url in second_pass:
            if url in visited:
                continue
            kind = classify_page_kind(url)
            try:
                page = fetch_page(url)
                text_nodes = normalize_text_lines(page.css("body ::text").getall())
                body_text = "\n".join(text_nodes)
                title = page.css("title::text").get()
                forms = [action for action in page.css("form::attr(action)").getall() if action]
                output.pages_crawled.append(
                    PageCrawlResult(
                        url=url,
                        page_kind=kind,
                        status="fetched",
                        title=title,
                        contact_form_detected=bool(forms),
                    )
                )
                output.emails_found.extend(extract_emails(body_text))
                output.phones_found.extend(extract_phones(body_text))
                output.people_found.extend(extract_named_people(text_nodes, url))
                output.category_clues.extend(extract_category_clues(body_text))
                output.contact_form_urls.extend(
                    [
                        resolved
                        for resolved in (
                            resolve_internal_url(url, form_action) for form_action in forms
                        )
                        if resolved
                    ]
                )
            except Exception as error:  # noqa: BLE001
                output.pages_crawled.append(
                    PageCrawlResult(
                        url=url,
                        page_kind=kind,
                        status="failed",
                        error=str(error),
                    )
                )
                output.warnings.append(f"Failed to fetch {url}: {error}")

    output.emails_found = dedupe_strings(output.emails_found)
    output.phones_found = dedupe_strings(output.phones_found)
    output.contact_form_urls = dedupe_strings(output.contact_form_urls)
    output.role_inbox_clues = extract_role_inboxes(output.emails_found)
    output.category_clues = dedupe_strings(output.category_clues)
    output.external_presence_hints = dedupe_strings(output.external_presence_hints)
    output.source_evidence = dedupe_strings(
        [
            f"Fetched {len([page for page in output.pages_crawled if page.status == 'fetched'])} page(s)"
            if output.pages_crawled
            else None,
            f"Staff/team pages found: {len([page for page in output.pages_crawled if page.page_kind in {'staff', 'team'} and page.status == 'fetched'])}"
            if any(
                page.page_kind in {"staff", "team"} and page.status == "fetched"
                for page in output.pages_crawled
            )
            else None,
            f"Contact pages found: {len([page for page in output.pages_crawled if page.page_kind == 'contact' and page.status == 'fetched'])}"
            if any(
                page.page_kind == "contact" and page.status == "fetched"
                for page in output.pages_crawled
            )
            else None,
            f"Named people found: {len(output.people_found)}" if output.people_found else None,
            f"Role inbox clues found: {len(output.role_inbox_clues)}"
            if output.role_inbox_clues
            else None,
        ]
    )
    output.confidence_hints = build_confidence_hints(output)
    return output
