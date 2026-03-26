from __future__ import annotations

import re
from urllib.parse import urlparse

try:
    from .models import PageKind
    from .models import PersonFinding
    from .models import WorkerOutput
except ImportError:
    from models import PageKind
    from models import PersonFinding
    from models import WorkerOutput

EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_PATTERN = re.compile(
    r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}"
)
ROLE_TITLE_PATTERN = re.compile(
    r"(owner|dealer principal|general manager|gm|sales manager|sales director|"
    r"manager|founder|president|director|finance manager|service manager|"
    r"internet manager|operations manager)",
    re.IGNORECASE,
)
DIRECTORY_DOMAINS = (
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
    "cars.com",
    "cargurus.com",
    "autotrader.com",
    "carfax.com",
    "yelp.com",
    "yellowpages.com",
    "mapquest.com",
    "google.com",
)
ROLE_INBOX_LOCALS = {
    "info",
    "sales",
    "hello",
    "contact",
    "support",
    "service",
    "office",
    "team",
    "admin",
    "customerservice",
}
PAGE_KIND_PATTERNS: list[tuple[str, PageKind]] = [
    ("meet-our-staff", "staff"),
    ("meet-our-team", "team"),
    ("meet-the-staff", "staff"),
    ("meet-the-team", "team"),
    ("staff-directory", "staff"),
    ("team-directory", "team"),
    ("sales-staff", "staff"),
    ("sales-team", "team"),
    ("service-staff", "staff"),
    ("service-team", "team"),
    ("parts-staff", "staff"),
    ("parts-team", "team"),
    ("finance-staff", "staff"),
    ("finance-team", "team"),
    ("management-team", "team"),
    ("our-staff", "staff"),
    ("our-team", "team"),
    ("our-people", "team"),
    ("departments", "team"),
    ("leadership", "team"),
    ("contact", "contact"),
    ("about", "about"),
    ("staff", "staff"),
    ("team", "team"),
]
CATEGORY_CLUE_MAP: list[tuple[str, str]] = [
    ("buy here pay here", "Buy here pay here dealer"),
    ("pre-owned", "Pre-owned auto dealer"),
    ("used car", "Used car dealership"),
    ("auto sales", "Auto sales dealership"),
    ("truck dealer", "Truck dealership"),
    ("truck sales", "Truck dealership"),
    ("motorcycle dealer", "Motorcycle dealer"),
    ("powersports", "Powersports dealer"),
]


def dedupe_strings(values: list[str | None]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = (value or "").strip()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def normalize_phone(value: str) -> str:
    return re.sub(r"[^\d+]", "", value)


def normalize_text_lines(values: list[str]) -> list[str]:
    cleaned = [
        re.sub(r"\s+", " ", value).strip()
        for value in values
        if value and value.strip()
    ]
    return [value for value in cleaned if value]


def looks_like_person_name(value: str) -> bool:
    if len(value) < 4 or len(value) > 60:
        return False
    if EMAIL_PATTERN.search(value) or PHONE_PATTERN.search(value):
        return False
    if ROLE_TITLE_PATTERN.search(value):
        return False
    return bool(re.match(r"^[A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3}$", value))


def clean_role_title(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[|/•]+", " ", value)).strip()


def extract_emails(text: str) -> list[str]:
    return dedupe_strings([match.lower() for match in EMAIL_PATTERN.findall(text)])


def extract_phones(text: str) -> list[str]:
    phones = [match.strip() for match in PHONE_PATTERN.findall(text)]
    return [
        phone
        for phone in dedupe_strings(phones)
        if len(normalize_phone(phone)) >= 10
    ]


def extract_named_people(lines: list[str], source_url: str) -> list[PersonFinding]:
    findings: list[PersonFinding] = []

    for line in lines:
        pair_match = re.match(
            r"^([A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3})\s*[-,|]\s*(.+)$",
            line,
        )
        if pair_match and ROLE_TITLE_PATTERN.search(pair_match.group(2) or ""):
            findings.append(
                PersonFinding(
                    full_name=pair_match.group(1),
                    title=clean_role_title(pair_match.group(2)),
                    source_url=source_url,
                    confidence="medium",
                )
            )
            continue

        reverse_match = re.match(
            r"^(.+?)\s*[-:|]\s*([A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3})$",
            line,
        )
        if reverse_match and ROLE_TITLE_PATTERN.search(reverse_match.group(1) or ""):
            findings.append(
                PersonFinding(
                    full_name=reverse_match.group(2),
                    title=clean_role_title(reverse_match.group(1)),
                    source_url=source_url,
                    confidence="medium",
                )
            )

    for index, line in enumerate(lines):
        next_lines = [candidate for candidate in lines[index + 1 : index + 3] if candidate]
        if looks_like_person_name(line):
            role_line = next(
                (candidate for candidate in next_lines if ROLE_TITLE_PATTERN.search(candidate)),
                None,
            )
            if role_line:
                findings.append(
                    PersonFinding(
                        full_name=line,
                        title=clean_role_title(role_line),
                        source_url=source_url,
                        confidence="high",
                    )
                )

        if ROLE_TITLE_PATTERN.search(line):
            name_line = next(
                (candidate for candidate in next_lines if looks_like_person_name(candidate)),
                None,
            )
            if name_line:
                findings.append(
                    PersonFinding(
                        full_name=name_line,
                        title=clean_role_title(line),
                        source_url=source_url,
                        confidence="medium",
                    )
                )

    deduped: dict[tuple[str, str], PersonFinding] = {}
    for finding in findings:
        key = (
            finding.full_name.lower(),
            (finding.title or "").lower(),
        )
        if key not in deduped:
            deduped[key] = finding
    return list(deduped.values())


def extract_role_inboxes(emails: list[str]) -> list[str]:
    return [
        email
        for email in emails
        if email.split("@")[0].lower() in ROLE_INBOX_LOCALS
    ]


def classify_page_kind(url: str) -> PageKind:
    lowered = url.lower()
    if lowered.rstrip("/") == lowered.split("://", 1)[-1].split("/", 1)[0]:
        return "homepage"
    for pattern, kind in PAGE_KIND_PATTERNS:
        if pattern in lowered:
            return kind
    return "other"


def extract_category_clues(text: str) -> list[str]:
    lowered = text.lower()
    matches: list[str] = []
    for pattern, label in CATEGORY_CLUE_MAP:
        if pattern in lowered:
            matches.append(label)
    return dedupe_strings(matches)


def extract_external_presence_hints(urls: list[str]) -> list[str]:
    hints: list[str] = []
    for url in urls:
        try:
            host = urlparse(url).hostname or ""
        except ValueError:
            continue
        if any(host == domain or host.endswith(f".{domain}") for domain in DIRECTORY_DOMAINS):
            hints.append(f"External profile linked: {host}")
    return dedupe_strings(hints)


def build_confidence_hints(output: WorkerOutput) -> list[str]:
    hints = [
        "Homepage fetch succeeded"
        if any(page.page_kind == "homepage" and page.status == "fetched" for page in output.pages_crawled)
        else None,
        f"Staff or team pages found: {len([page for page in output.pages_crawled if page.page_kind in {'staff', 'team'} and page.status == 'fetched'])}"
        if any(page.page_kind in {"staff", "team"} and page.status == "fetched" for page in output.pages_crawled)
        else None,
        f"Named people extracted: {len(output.people_found)}" if output.people_found else None,
        f"Exact-domain role inboxes found: {len(output.role_inbox_clues)}"
        if output.role_inbox_clues
        else None,
        f"Contact forms detected: {len(output.contact_form_urls)}"
        if output.contact_form_urls
        else None,
    ]
    return dedupe_strings(hints)
