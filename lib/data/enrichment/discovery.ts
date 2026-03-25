import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import {
  extractLikelyInternalPageCandidates,
  getSupportingPageUrlsByKind,
  type SupportingPageCandidate,
} from "@/lib/data/enrichment/site-pages";
import type {
  Company,
  CompanyWebsiteDiscoverySnapshot,
  EnrichmentConfidenceLevel,
  SourceReference,
} from "@/lib/domain";

const SEARCH_ENGINE_URL = "https://duckduckgo.com/html/";
const BLOCKED_DISCOVERY_DOMAINS = [
  "duckduckgo.com",
  "google.com",
  "bing.com",
  "yelp.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "cars.com",
  "cargurus.com",
  "autotrader.com",
  "carfax.com",
  "yellowpages.com",
  "mapquest.com",
  "youtube.com",
  "superpages.com",
  "manta.com",
  "dealercenter.net",
  "carsforsale.com",
  "loc8nearme.com",
  "findglocal.com",
];
const DIRECTORY_HINT_PATTERNS = [
  /\bdirectory\b/i,
  /\blisting\b/i,
  /\breviews?\b/i,
  /\bnear me\b/i,
  /\bclassifieds?\b/i,
  /\bmarketplace\b/i,
];

interface SearchCandidate {
  url: string;
  title: string;
  snippet: string;
  queryLabel: string;
}

interface ScoredSearchCandidate extends SearchCandidate {
  score: number;
  signals: string[];
  supportingPageCandidates: SupportingPageCandidate[];
  extractedEvidence: string[];
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

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
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/[^\d]/g, "");
}

function normalizeNameForComparison(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function createDiscoverySource(now: string, url: string | undefined): SourceReference {
  return {
    kind: "provider",
    provider: "open_web_discovery",
    label: "Open-web website discovery",
    url,
    observedAt: now,
  };
}

function getConfidenceLevel(score: number): EnrichmentConfidenceLevel {
  if (score >= 88) {
    return "high";
  }

  if (score >= 68) {
    return "medium";
  }

  if (score >= 48) {
    return "low";
  }

  return "none";
}

function normalizeCandidateUrl(rawUrl: string) {
  try {
    const decoded = decodeURIComponent(rawUrl);
    const asSearchRedirect = new URL(decoded, SEARCH_ENGINE_URL);
    const redirected =
      asSearchRedirect.searchParams.get("uddg") ??
      asSearchRedirect.searchParams.get("rut") ??
      decoded;
    const normalized = normalizeWebsiteUrl(redirected);

    if (!normalized) {
      return undefined;
    }

    const url = new URL(normalized);

    return `${url.protocol}//${url.host.toLowerCase()}`;
  } catch {
    return undefined;
  }
}

function buildCompanyTokens(company: Company) {
  const tokens = company.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter(
      (token) =>
        ![
          "auto",
          "autos",
          "motors",
          "cars",
          "car",
          "the",
          "inc",
          "llc",
          "co",
          "used",
        ].includes(token),
    );

  return tokens.length > 0
    ? tokens
    : company.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1);
}

function extractReferenceTokens(value: string | undefined) {
  if (!value) {
    return [];
  }

  return dedupeStrings(
    decodeURIComponent(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter(
        (token) =>
          ![
            "https",
            "http",
            "www",
            "google",
            "maps",
            "map",
            "place",
            "search",
            "reviews",
            "review",
            "business",
          ].includes(token),
      ),
  );
}

function isBlockedDomain(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();

    return BLOCKED_DISCOVERY_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return true;
  }
}

function looksLikeDirectoryCandidate(candidate: { title: string; snippet: string; url: string }) {
  const haystack = `${candidate.title} ${candidate.snippet} ${candidate.url}`.toLowerCase();

  return DIRECTORY_HINT_PATTERNS.some((pattern) => pattern.test(haystack));
}

function extractSearchCandidates(html: string, queryLabel: string) {
  const results: SearchCandidate[] = [];
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const normalizedUrl = normalizeCandidateUrl(match[1]);

    if (!normalizedUrl || isBlockedDomain(normalizedUrl)) {
      continue;
    }

    const title = stripHtml(match[2] ?? "");

    if (title.length < 3) {
      continue;
    }

    const snippet = stripHtml(html.slice(match.index, match.index + 520));
    results.push({
      url: normalizedUrl,
      title,
      snippet,
      queryLabel,
    });
  }

  return results.filter(
    (candidate, index, collection) =>
      collection.findIndex((current) => current.url === candidate.url) === index,
  );
}

function buildDiscoveryQueries(company: Company) {
  const profileTokens = extractReferenceTokens(
    company.presence.googleBusinessProfileUrl,
  ).slice(0, 3);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const queryVariants = [
    {
      label: "business name + location",
      value: [
        `"${company.name}"`,
        company.location.city,
        company.location.state,
        "official site",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      label: "business name + location + phone",
      value: [
        `"${company.name}"`,
        company.location.city,
        company.location.state,
        phoneDigits,
        "contact",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      label: "business name + maps profile hints",
      value: [
        `"${company.name}"`,
        company.location.city,
        company.location.state,
        ...profileTokens,
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];

  return queryVariants.filter(
    (variant, index, collection) =>
      variant.value.length > 0 &&
      collection.findIndex((current) => current.value === variant.value) === index,
  );
}

function scoreSearchCandidate(
  company: Company,
  candidate: SearchCandidate,
) {
  const companyTokens = buildCompanyTokens(company);
  const referenceTokens = extractReferenceTokens(
    company.presence.googleBusinessProfileUrl,
  );
  const url = new URL(candidate.url);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const haystack = `${candidate.title} ${candidate.snippet} ${host}`.toLowerCase();
  const normalizedCompanyName = normalizeNameForComparison(company.name);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const phoneMatch =
    phoneDigits && candidate.snippet.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7));
  let score = 0;
  const signals: string[] = [`Search query matched: ${candidate.queryLabel}`];

  if (normalizeNameForComparison(haystack).includes(normalizedCompanyName)) {
    score += 24;
    signals.push("Candidate strongly matches the business name");
  }

  const tokenMatches = companyTokens.filter((token) => haystack.includes(token));
  score += tokenMatches.length * 10;

  if (tokenMatches.length >= Math.min(2, companyTokens.length)) {
    signals.push("Candidate mentions the company name");
  }

  if (haystack.includes(company.location.city.toLowerCase())) {
    score += 10;
    signals.push("Candidate matches the company city");
  }

  if (haystack.includes(company.location.state.toLowerCase())) {
    score += 8;
    signals.push("Candidate matches the company state");
  }

  if (phoneMatch) {
    score += 18;
    signals.push("Candidate matches the imported phone number");
  }

  const hostTokenMatches = companyTokens.filter((token) => host.includes(token));
  score += hostTokenMatches.length * 8;

  if (hostTokenMatches.length > 0) {
    signals.push("Domain plausibly matches the business name");
  }

  if (referenceTokens.some((token) => haystack.includes(token))) {
    score += 8;
    signals.push("Candidate aligns with maps/business-profile reference hints");
  }

  if (/\bofficial site\b/i.test(candidate.title) || /\bofficial\b/i.test(candidate.snippet)) {
    score += 6;
    signals.push("Candidate presents itself as the official site");
  }

  if (host.endsWith(".com") || host.endsWith(".ca")) {
    score += 4;
  }

  if (looksLikeDirectoryCandidate(candidate)) {
    score -= 36;
    signals.push("Candidate looks like a directory or third-party listing");
  }

  return {
    score: Math.max(0, score),
    signals: dedupeStrings(signals),
  };
}

async function fetchSearchCandidatesForQuery(
  company: Company,
  query: { label: string; value: string },
) {
  const response = await fetch(
    `${SEARCH_ENGINE_URL}?q=${encodeURIComponent(query.value)}`,
    {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "user-agent":
          "GoPinion Outbound OS discovery bot (+https://gopinion.ai)",
        accept: "text/html,application/xhtml+xml",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  return extractSearchCandidates(html, query.label).map((candidate) => {
    const scored = scoreSearchCandidate(company, candidate);

    return {
      ...candidate,
      score: scored.score,
      signals: scored.signals,
      supportingPageCandidates: [],
      extractedEvidence: [],
    } satisfies ScoredSearchCandidate;
  });
}

async function fetchCandidateHomepage(candidateUrl: string) {
  const response = await fetch(candidateUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(4_000),
    headers: {
      "user-agent":
        "GoPinion Outbound OS discovery bot (+https://gopinion.ai)",
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

function verifyCandidateHomepage(company: Company, candidateUrl: string, html: string) {
  const text = stripHtml(html).toLowerCase();
  const companyTokens = buildCompanyTokens(company);
  const normalizedCompanyName = normalizeNameForComparison(company.name);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const street = company.location.streetAddress?.toLowerCase();
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const supportingPageCandidates = extractLikelyInternalPageCandidates(
    html,
    candidateUrl,
    10,
  );
  let score = 0;
  const signals: string[] = [];

  if (normalizeNameForComparison(`${title} ${text}`).includes(normalizedCompanyName)) {
    score += 24;
    signals.push("Homepage content strongly matches the business name");
  }

  const tokenMatches = companyTokens.filter((token) => text.includes(token));
  score += tokenMatches.length * 8;

  if (tokenMatches.length >= Math.min(2, companyTokens.length)) {
    signals.push("Homepage content matches the business name");
  }

  if (text.includes(company.location.city.toLowerCase())) {
    score += 10;
    signals.push("Homepage references the correct city");
  }

  if (text.includes(company.location.state.toLowerCase())) {
    score += 8;
    signals.push("Homepage references the correct state");
  }

  if (street && text.includes(street.split(",")[0]?.toLowerCase() ?? "")) {
    score += 12;
    signals.push("Homepage references the imported street address");
  }

  if (phoneDigits && text.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7))) {
    score += 18;
    signals.push("Homepage references the imported phone number");
  }

  const staffPageUrls = getSupportingPageUrlsByKind(supportingPageCandidates, "staff");
  const contactPageUrls = getSupportingPageUrlsByKind(
    supportingPageCandidates,
    "contact",
  );

  if (staffPageUrls.length > 0) {
    score += 12;
    signals.push("Homepage links to a public staff or team page");
  }

  if (contactPageUrls.length > 0) {
    score += 8;
    signals.push("Homepage links to a public contact page");
  }

  return {
    score,
    signals,
    supportingPageCandidates,
    extractedEvidence: dedupeStrings([
      staffPageUrls.length > 0
        ? `Found ${staffPageUrls.length} staff/team page candidate${
            staffPageUrls.length === 1 ? "" : "s"
          } from the homepage`
        : undefined,
      contactPageUrls.length > 0
        ? `Found ${contactPageUrls.length} contact page candidate${
            contactPageUrls.length === 1 ? "" : "s"
          } from the homepage`
        : undefined,
    ]),
  };
}

function createDiscoverySnapshot(params: {
  now: string;
  status: CompanyWebsiteDiscoverySnapshot["status"];
  confidenceScore: number;
  discoveredWebsite?: string;
  candidateUrls?: string[];
  matchedSignals?: string[];
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  lastError?: string;
  source?: SourceReference;
}) {
  return {
    status: params.status,
    confidenceLevel: getConfidenceLevel(params.confidenceScore),
    confidenceScore: Math.max(0, Math.min(100, Math.round(params.confidenceScore))),
    discoveredWebsite: params.discoveredWebsite,
    candidateUrls: params.candidateUrls ?? [],
    matchedSignals: params.matchedSignals ?? [],
    supportingPageUrls: params.supportingPageUrls ?? [],
    contactPageUrls: params.contactPageUrls ?? [],
    staffPageUrls: params.staffPageUrls ?? [],
    extractedEvidence: params.extractedEvidence ?? [],
    source: params.source ?? createDiscoverySource(params.now, params.discoveredWebsite),
    lastCheckedAt: params.now,
    lastError: params.lastError,
  } satisfies CompanyWebsiteDiscoverySnapshot;
}

export function buildRecordProvidedDiscoverySnapshot(params: {
  website: string;
  now: string;
  source: SourceReference;
  status?: CompanyWebsiteDiscoverySnapshot["status"];
  matchedSignals?: string[];
}) {
  const normalizedWebsite = normalizeWebsiteUrl(params.website) ?? params.website;

  return createDiscoverySnapshot({
    now: params.now,
    status: params.status ?? "record_provided",
    confidenceScore: 92,
    discoveredWebsite: normalizedWebsite,
    candidateUrls: [normalizedWebsite],
    matchedSignals:
      params.matchedSignals ?? ["Website was already present on the lead record"],
    supportingPageUrls: [],
    contactPageUrls: [],
    staffPageUrls: [],
    extractedEvidence: [],
    source: params.source,
  });
}

export function mergeWebsiteDiscoveryEvidence(params: {
  snapshot: CompanyWebsiteDiscoverySnapshot;
  now: string;
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  lastError?: string;
}) {
  return createDiscoverySnapshot({
    now: params.now,
    status: params.snapshot.status,
    confidenceScore: params.snapshot.confidenceScore,
    discoveredWebsite: params.snapshot.discoveredWebsite,
    candidateUrls: params.snapshot.candidateUrls,
    matchedSignals: params.snapshot.matchedSignals,
    supportingPageUrls: dedupeStrings([
      ...params.snapshot.supportingPageUrls,
      ...(params.supportingPageUrls ?? []),
    ]),
    contactPageUrls: dedupeStrings([
      ...params.snapshot.contactPageUrls,
      ...(params.contactPageUrls ?? []),
    ]),
    staffPageUrls: dedupeStrings([
      ...params.snapshot.staffPageUrls,
      ...(params.staffPageUrls ?? []),
    ]),
    extractedEvidence: dedupeStrings([
      ...params.snapshot.extractedEvidence,
      ...(params.extractedEvidence ?? []),
    ]),
    lastError: params.lastError ?? params.snapshot.lastError,
    source: params.snapshot.source,
  });
}

export async function discoverCompanyWebsite(
  company: Company,
  now: string,
): Promise<CompanyWebsiteDiscoverySnapshot> {
  if (company.presence.websiteUrl) {
    return buildRecordProvidedDiscoverySnapshot({
      website: company.presence.websiteUrl,
      now,
      source: company.source,
    });
  }

  const queries = buildDiscoveryQueries(company);

  try {
    const settledSearches = await Promise.allSettled(
      queries.map((query) => fetchSearchCandidatesForQuery(company, query)),
    );
    const searchErrors = settledSearches.flatMap((result) =>
      result.status === "rejected"
        ? [result.reason instanceof Error ? result.reason.message : "Search fetch failed"]
        : [],
    );
    const mergedCandidates = new Map<string, ScoredSearchCandidate>();

    for (const result of settledSearches) {
      if (result.status !== "fulfilled") {
        continue;
      }

      for (const candidate of result.value) {
        const existing = mergedCandidates.get(candidate.url);

        if (!existing || candidate.score > existing.score) {
          mergedCandidates.set(candidate.url, candidate);
        } else {
          mergedCandidates.set(candidate.url, {
            ...existing,
            signals: dedupeStrings([...existing.signals, ...candidate.signals]),
          });
        }
      }
    }

    const candidates = [...mergedCandidates.values()]
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    if (candidates.length === 0) {
      return createDiscoverySnapshot({
        now,
        status: searchErrors.length > 0 ? "failed" : "not_found",
        confidenceScore: 0,
        matchedSignals: [
          searchErrors.length > 0
            ? "Open-web discovery failed before a candidate could be verified"
            : "No credible website candidates were found from open-web search",
        ],
        lastError: searchErrors[0],
        source: createDiscoverySource(now, undefined),
      });
    }

    const verifiedCandidates = await Promise.all(
      candidates.slice(0, 3).map(async (candidate) => {
        try {
          const homepageHtml = await fetchCandidateHomepage(candidate.url);
          const homepageVerification = verifyCandidateHomepage(
            company,
            candidate.url,
            homepageHtml,
          );

          return {
            ...candidate,
            score: candidate.score + homepageVerification.score,
            signals: dedupeStrings([
              ...candidate.signals,
              ...homepageVerification.signals,
            ]),
            supportingPageCandidates: homepageVerification.supportingPageCandidates,
            extractedEvidence: homepageVerification.extractedEvidence,
          };
        } catch {
          return candidate;
        }
      }),
    );

    const bestCandidate = [...verifiedCandidates].sort(
      (left, right) => right.score - left.score,
    )[0];

    if (!bestCandidate || bestCandidate.score < 48) {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confidenceScore: bestCandidate?.score ?? 0,
        candidateUrls: candidates.map((candidate) => candidate.url),
        matchedSignals: bestCandidate?.signals ?? [
          "Search produced results, but none were strong enough to auto-apply",
        ],
        extractedEvidence: bestCandidate?.extractedEvidence ?? [],
        source: createDiscoverySource(now, undefined),
      });
    }

    return createDiscoverySnapshot({
      now,
      status: "discovered",
      confidenceScore: bestCandidate.score,
      discoveredWebsite: bestCandidate.url,
      candidateUrls: candidates.map((candidate) => candidate.url),
      matchedSignals: bestCandidate.signals,
      supportingPageUrls: dedupeStrings(
        bestCandidate.supportingPageCandidates.map((candidate) => candidate.url),
      ),
      contactPageUrls: getSupportingPageUrlsByKind(
        bestCandidate.supportingPageCandidates,
        "contact",
      ),
      staffPageUrls: getSupportingPageUrlsByKind(
        bestCandidate.supportingPageCandidates,
        "staff",
      ),
      extractedEvidence: bestCandidate.extractedEvidence,
      source: createDiscoverySource(now, bestCandidate.url),
    });
  } catch (error) {
    return createDiscoverySnapshot({
      now,
      status: "failed",
      confidenceScore: 0,
      matchedSignals: ["Open-web discovery failed before a candidate could be verified"],
      lastError:
        error instanceof Error
          ? error.message
          : "Website discovery failed unexpectedly.",
      source: createDiscoverySource(now, undefined),
    });
  }
}
