from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from dataclasses import field
from typing import Literal
from typing import Optional

PageKind = Literal["homepage", "contact", "about", "team", "staff", "other"]
PageStatus = Literal["fetched", "skipped", "failed"]
ConfidenceLabel = Literal["high", "medium", "low"]


@dataclass(slots=True)
class WorkerRequest:
    website: Optional[str] = None
    preferred_page_urls: list[str] = field(default_factory=list)
    likely_page_paths: list[str] = field(default_factory=list)
    timeout_seconds: float = 12.0
    max_pages: int = 10


@dataclass(slots=True)
class PersonFinding:
    full_name: str
    source_url: str
    confidence: ConfidenceLabel = "low"
    title: Optional[str] = None


@dataclass(slots=True)
class PageCrawlResult:
    url: str
    page_kind: PageKind
    status: PageStatus
    title: Optional[str] = None
    contact_form_detected: bool = False
    error: Optional[str] = None


@dataclass(slots=True)
class WorkerOutput:
    website_used: Optional[str] = None
    pages_crawled: list[PageCrawlResult] = field(default_factory=list)
    emails_found: list[str] = field(default_factory=list)
    phones_found: list[str] = field(default_factory=list)
    people_found: list[PersonFinding] = field(default_factory=list)
    role_inbox_clues: list[str] = field(default_factory=list)
    contact_form_urls: list[str] = field(default_factory=list)
    source_evidence: list[str] = field(default_factory=list)
    confidence_hints: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    category_clues: list[str] = field(default_factory=list)
    external_presence_hints: list[str] = field(default_factory=list)
    description_snippet: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)
