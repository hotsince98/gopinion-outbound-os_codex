import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import {
  classifySupportingPageCandidate,
  extractLikelyInternalPageCandidates,
  getSupportingPageUrlsByKind,
  type SupportingPageCandidate,
  type SupportingPageKind,
} from "@/lib/data/enrichment/site-pages";

export interface WebsiteNamedContactCandidate {
  fullName: string;
  title?: string;
  sourceUrl: string;
}

export interface WebsiteScanResult {
  normalizedWebsite?: string;
  requestedProvider?: "basic" | "scrapling";
  actualProvider?: "basic" | "scrapling";
  fallbackUsed?: boolean;
  fallbackReason?: string;
  providerEvidence?: string[];
  pagesChecked: string[];
  sourceUrls: string[];
  supportingPageUrls: string[];
  contactPageUrls: string[];
  staffPageUrls: string[];
  emails: string[];
  phones: string[];
  namedContacts: WebsiteNamedContactCandidate[];
  categoryClues: string[];
  evidenceSummary: string[];
  descriptionSnippet?: string;
  lastError?: string;
}

interface WebsitePageCandidate {
  url: string;
  kind: SupportingPageKind;
  reason: string;
  score: number;
}

interface FetchedWebsitePage {
  url: string;
  kind: SupportingPageKind;
  title?: string;
  descriptionSnippet?: string;
  emails: string[];
  phones: string[];
  namedContacts: WebsiteNamedContactCandidate[];
  categoryClues: string[];
  supportingCandidates: SupportingPageCandidate[];
}

const FIXED_PAGE_PATH_CANDIDATES = [
  "",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/meet-our-team",
  "/meet-our-staff",
  "/meet-the-team",
  "/meet-the-staff",
  "/our-team",
  "/our-staff",
  "/sales-team",
  "/sales-staff",
  "/service-team",
  "/service-staff",
  "/parts-team",
  "/parts-staff",
  "/finance-team",
  "/finance-staff",
  "/management",
  "/management-team",
  "/leadership",
  "/departments",
  "/our-people",
  "/staff-directory",
  "/team-directory",
  "/hours-and-directions",
  "/directions",
] as const;

const MAX_PAGE_FETCHES = 12;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ROLE_TITLE_PATTERN =
  /(owner|dealer principal|general manager|gm|sales manager|sales director|manager|founder|president|director|finance manager|service manager|internet manager|operations manager)/i;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6|span)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function dedupeStrings(values: ReadonlyArray<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : undefined;
}

function getMetaDescription(html: string) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  );

  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : undefined;
}

function extractEmails(text: string) {
  return dedupeStrings(text.match(EMAIL_PATTERN) ?? []).map((value) =>
    value.toLowerCase(),
  );
}

function extractPhones(text: string) {
  return dedupeStrings(text.match(PHONE_PATTERN) ?? [])
    .map((value) => value.trim())
    .filter((value) => normalizePhone(value).length >= 10);
}

function looksLikePersonName(line: string) {
  if (line.length < 4 || line.length > 60) {
    return false;
  }

  if (ROLE_TITLE_PATTERN.test(line) || EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) {
    return false;
  }

  return /^[A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3}$/u.test(line);
}

function cleanRoleTitle(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/[|•/]+/g, " ")
    .trim();
}

function extractNamedContacts(
  text: string,
  sourceUrl: string,
  pageKind: SupportingPageKind,
): WebsiteNamedContactCandidate[] {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 120);
  const matches: WebsiteNamedContactCandidate[] = [];

  for (const line of lines) {
    const pairMatch = line.match(
      /^([A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3})\s*[-,|]\s*(.+)$/u,
    );

    if (pairMatch && ROLE_TITLE_PATTERN.test(pairMatch[2] ?? "")) {
      matches.push({
        fullName: pairMatch[1],
        title: cleanRoleTitle(pairMatch[2] ?? ""),
        sourceUrl,
      });
      continue;
    }

    const reverseMatch = line.match(
      /^(.+?)\s*[-:|]\s*([A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3})$/u,
    );

    if (reverseMatch && ROLE_TITLE_PATTERN.test(reverseMatch[1] ?? "")) {
      matches.push({
        fullName: reverseMatch[2],
        title: cleanRoleTitle(reverseMatch[1] ?? ""),
        sourceUrl,
      });
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLines = [lines[index + 1], lines[index + 2]].filter(
      (value): value is string => Boolean(value),
    );

    if (looksLikePersonName(line)) {
      const roleLine = nextLines.find((candidate) => ROLE_TITLE_PATTERN.test(candidate));

      if (roleLine) {
        matches.push({
          fullName: line,
          title: cleanRoleTitle(roleLine),
          sourceUrl,
        });
      }
    }

    if (
      (pageKind === "staff" || pageKind === "about" || pageKind === "contact") &&
      ROLE_TITLE_PATTERN.test(line)
    ) {
      const nameLine = nextLines.find((candidate) => looksLikePersonName(candidate));

      if (nameLine) {
        matches.push({
          fullName: nameLine,
          title: cleanRoleTitle(line),
          sourceUrl,
        });
      }
    }
  }

  const deduped = new Map<string, WebsiteNamedContactCandidate>();

  for (const match of matches) {
    const key = `${match.fullName.toLowerCase()}::${match.title?.toLowerCase() ?? ""}`;

    if (!deduped.has(key)) {
      deduped.set(key, match);
    }
  }

  return [...deduped.values()];
}

function extractCategoryClues(text: string) {
  const normalized = text.toLowerCase();
  const matches: string[] = [];
  const clueMap: Array<[string, string]> = [
    ["buy here pay here", "Buy here pay here dealer"],
    ["pre-owned", "Pre-owned auto dealer"],
    ["used car", "Used car dealership"],
    ["auto sales", "Auto sales dealership"],
    ["truck dealer", "Truck dealership"],
    ["truck sales", "Truck dealership"],
    ["motorcycle dealer", "Motorcycle dealer"],
    ["powersports", "Powersports dealer"],
  ];

  for (const [pattern, label] of clueMap) {
    if (normalized.includes(pattern)) {
      matches.push(label);
    }
  }

  return dedupeStrings(matches);
}

function extractDescriptionSnippet(text: string, html: string) {
  const metaDescription = getMetaDescription(html);

  if (metaDescription) {
    return metaDescription;
  }

  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 60 && line.length < 240);

  return lines[0];
}

async function fetchHtmlPage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(4_000),
    headers: {
      "user-agent":
        "GoPinion Outbound OS enrichment bot (+https://gopinion.ai)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error(`Unexpected content type ${contentType}`);
  }

  return await response.text();
}

function buildFixedPageCandidates(normalizedWebsite: string): WebsitePageCandidate[] {
  const homepageUrl = new URL(normalizedWebsite);

  return FIXED_PAGE_PATH_CANDIDATES.map((path) => {
    const url = new URL(path, homepageUrl).toString();

    if (!path) {
      return {
        url,
        kind: "homepage" as const,
        reason: "Homepage candidate",
        score: 100,
      };
    }

    const kind =
      classifySupportingPageCandidate({ href: url }) ??
      ("about" as const);

    return {
      url,
      kind,
      reason: `${kind === "staff" ? "Staff/team" : kind} path heuristic`,
      score: kind === "staff" ? 88 : kind === "contact" ? 80 : 68,
    };
  });
}

function buildMergedPageCandidates(params: {
  normalizedWebsite: string;
  preferredPageUrls?: string[];
  linkedCandidates?: SupportingPageCandidate[];
}) {
  const merged = new Map<string, WebsitePageCandidate>();
  const base = new URL(params.normalizedWebsite);

  for (const candidate of buildFixedPageCandidates(params.normalizedWebsite)) {
    merged.set(candidate.url, candidate);
  }

  for (const url of params.preferredPageUrls ?? []) {
    try {
      const resolved = new URL(url, base);

      if (resolved.hostname !== base.hostname) {
        continue;
      }

      const normalized =
        `${resolved.protocol}//${resolved.host.toLowerCase()}${
          resolved.pathname === "/" ? "" : resolved.pathname.replace(/\/+$/, "")
        }${resolved.search}`;
      const kind =
        classifySupportingPageCandidate({ href: normalized }) ??
        ("about" as const);
      const existing = merged.get(normalized);

      if (!existing || existing.score < 92) {
        merged.set(normalized, {
          url: normalized,
          kind,
          reason: "Preferred page candidate from website discovery",
          score: 92,
        });
      }
    } catch {
      continue;
    }
  }

  for (const candidate of params.linkedCandidates ?? []) {
    const existing = merged.get(candidate.url);

    if (!existing || candidate.score > existing.score) {
      merged.set(candidate.url, {
        url: candidate.url,
        kind: candidate.kind,
        reason: candidate.reason,
        score: candidate.score,
      });
    }
  }

  return [...merged.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.url.localeCompare(right.url);
    })
    .slice(0, MAX_PAGE_FETCHES);
}

function classifyFetchedPage(
  url: string,
  title: string | undefined,
  candidatesByUrl: Map<string, WebsitePageCandidate>,
  normalizedWebsite: string,
): SupportingPageKind {
  if (url === normalizedWebsite) {
    return "homepage";
  }

  return (
    candidatesByUrl.get(url)?.kind ??
    classifySupportingPageCandidate({ href: url, text: title }) ??
    "about"
  );
}

function buildFetchedPage(
  html: string,
  url: string,
  kind: SupportingPageKind,
): FetchedWebsitePage {
  const title = getTitle(html);
  const text = stripHtml(html);

  return {
    url,
    kind,
    title,
    descriptionSnippet: extractDescriptionSnippet(text, html),
    emails: extractEmails(`${html}\n${text}`),
    phones: extractPhones(text),
    namedContacts: extractNamedContacts(text, url, kind),
    categoryClues: extractCategoryClues(
      [title, getMetaDescription(html), text].filter(Boolean).join("\n"),
    ),
    supportingCandidates: extractLikelyInternalPageCandidates(html, url, 6),
  };
}

function buildEvidenceSummary(params: {
  staffPageUrls: string[];
  contactPageUrls: string[];
  supportingPageUrls: string[];
  namedContacts: WebsiteNamedContactCandidate[];
  emails: string[];
  phones: string[];
}) {
  return dedupeStrings([
    params.staffPageUrls.length > 0
      ? `Found ${params.staffPageUrls.length} staff/team page${
          params.staffPageUrls.length === 1 ? "" : "s"
        }`
      : undefined,
    params.contactPageUrls.length > 0
      ? `Found ${params.contactPageUrls.length} contact page${
          params.contactPageUrls.length === 1 ? "" : "s"
        }`
      : undefined,
    params.namedContacts.length > 0
      ? `Extracted ${params.namedContacts.length} named contact clue${
          params.namedContacts.length === 1 ? "" : "s"
        }`
      : undefined,
    params.emails.length > 0
      ? `Extracted ${params.emails.length} email path${
          params.emails.length === 1 ? "" : "s"
        }`
      : undefined,
    params.phones.length > 0
      ? `Extracted ${params.phones.length} phone path${
          params.phones.length === 1 ? "" : "s"
        }`
      : undefined,
    params.supportingPageUrls.length > 0
      ? `Public site exposed ${params.supportingPageUrls.length} supporting page${
          params.supportingPageUrls.length === 1 ? "" : "s"
        }`
      : undefined,
  ]);
}

export async function scanCompanyWebsite(
  website: string | undefined,
  options?: {
    preferredPageUrls?: string[];
  },
): Promise<WebsiteScanResult> {
  const normalizedWebsite = normalizeWebsiteUrl(website);

  if (!normalizedWebsite) {
    return {
      normalizedWebsite: undefined,
      pagesChecked: [],
      sourceUrls: [],
      supportingPageUrls: [],
      contactPageUrls: [],
      staffPageUrls: [],
      emails: [],
      phones: [],
      namedContacts: [],
      categoryClues: [],
      evidenceSummary: [],
      lastError: "No valid website was available for enrichment.",
    };
  }

  let homepagePage: FetchedWebsitePage | undefined;
  let homepageLinkedCandidates: SupportingPageCandidate[] = [];
  let homepageError: string | undefined;

  try {
    const homepageHtml = await fetchHtmlPage(normalizedWebsite);

    homepagePage = buildFetchedPage(homepageHtml, normalizedWebsite, "homepage");
    homepageLinkedCandidates = homepagePage.supportingCandidates;
  } catch (error) {
    homepageError =
      error instanceof Error ? error.message : "Homepage fetch failed unexpectedly.";
  }

  const initialCandidates = buildMergedPageCandidates({
    normalizedWebsite,
    preferredPageUrls: options?.preferredPageUrls,
    linkedCandidates: homepageLinkedCandidates,
  });
  const candidatesByUrl = new Map(initialCandidates.map((candidate) => [candidate.url, candidate] as const));
  const remainingCandidateUrls = initialCandidates
    .map((candidate) => candidate.url)
    .filter((url) => url !== normalizedWebsite);

  const firstWave = await Promise.allSettled(
    remainingCandidateUrls.map(async (url) => {
      const html = await fetchHtmlPage(url);
      const kind = classifyFetchedPage(url, getTitle(html), candidatesByUrl, normalizedWebsite);

      return buildFetchedPage(html, url, kind);
    }),
  );

  const fetchedPages = [
    ...(homepagePage ? [homepagePage] : []),
    ...firstWave.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  ];
  const pageErrors = [
    ...(homepageError ? [homepageError] : []),
    ...firstWave.flatMap((result) =>
      result.status === "rejected"
        ? [result.reason instanceof Error ? result.reason.message : "Unknown fetch error"]
        : [],
    ),
  ];
  const secondWaveCandidates = buildMergedPageCandidates({
    normalizedWebsite,
    linkedCandidates: fetchedPages.flatMap((page) => page.supportingCandidates),
  }).filter(
    (candidate) => !fetchedPages.some((page) => page.url === candidate.url),
  );
  const secondWaveLimit = Math.max(0, MAX_PAGE_FETCHES - fetchedPages.length);
  const secondWave = await Promise.allSettled(
    secondWaveCandidates.slice(0, secondWaveLimit).map(async (candidate) => {
      const html = await fetchHtmlPage(candidate.url);
      const kind = classifyFetchedPage(
        candidate.url,
        getTitle(html),
        new Map([...candidatesByUrl, [candidate.url, candidate]]),
        normalizedWebsite,
      );

      return buildFetchedPage(html, candidate.url, kind);
    }),
  );

  const successfulPages = [
    ...fetchedPages,
    ...secondWave.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  ];
  const allPageErrors = [
    ...pageErrors,
    ...secondWave.flatMap((result) =>
      result.status === "rejected"
        ? [result.reason instanceof Error ? result.reason.message : "Unknown fetch error"]
        : [],
    ),
  ];
  const pagesChecked = dedupeStrings([
    normalizedWebsite,
    ...remainingCandidateUrls,
    ...secondWaveCandidates.map((candidate) => candidate.url),
  ]);
  const sourceUrls = dedupeStrings(successfulPages.map((page) => page.url));
  const supportingPageCandidates = successfulPages.flatMap((page) =>
    page.kind === "homepage"
      ? page.supportingCandidates
      : [
          {
            url: page.url,
            kind: page.kind,
            reason: `${page.kind === "staff" ? "Staff/team" : page.kind} page fetched successfully`,
            score: page.kind === "staff" ? 96 : page.kind === "contact" ? 88 : 72,
          } satisfies SupportingPageCandidate,
        ],
  );
  const supportingPageUrls = dedupeStrings([
    ...getSupportingPageUrlsByKind(supportingPageCandidates, "contact"),
    ...getSupportingPageUrlsByKind(supportingPageCandidates, "about"),
    ...getSupportingPageUrlsByKind(supportingPageCandidates, "staff"),
  ]);
  const contactPageUrls = getSupportingPageUrlsByKind(
    supportingPageCandidates,
    "contact",
  );
  const staffPageUrls = getSupportingPageUrlsByKind(
    supportingPageCandidates,
    "staff",
  );
  const emails = dedupeStrings(successfulPages.flatMap((page) => page.emails));
  const phones = dedupeStrings(successfulPages.flatMap((page) => page.phones));
  const namedContacts = successfulPages.flatMap((page) => page.namedContacts);
  const categoryClues = dedupeStrings(
    successfulPages.flatMap((page) => page.categoryClues),
  );
  const evidenceSummary = buildEvidenceSummary({
    staffPageUrls,
    contactPageUrls,
    supportingPageUrls,
    namedContacts,
    emails,
    phones,
  });

  return {
    normalizedWebsite,
    pagesChecked,
    sourceUrls,
    supportingPageUrls,
    contactPageUrls,
    staffPageUrls,
    emails,
    phones,
    namedContacts,
    categoryClues,
    evidenceSummary,
    descriptionSnippet:
      successfulPages.find((page) => page.descriptionSnippet)?.descriptionSnippet,
    lastError:
      successfulPages.length === 0
        ? allPageErrors[0] ?? "No website pages could be fetched."
        : undefined,
  };
}
