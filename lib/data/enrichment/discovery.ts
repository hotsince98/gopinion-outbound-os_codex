import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
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
  "dealeron.com",
  "yellowpages.com",
  "mapquest.com",
  "youtube.com",
];

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
  if (score >= 84) {
    return "high";
  }

  if (score >= 64) {
    return "medium";
  }

  if (score >= 40) {
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
    .filter((token) => !["auto", "autos", "motors", "cars", "car", "the", "inc", "llc", "co"].includes(token));

  return tokens.length > 0
    ? tokens
    : company.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1);
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

function extractSearchCandidates(html: string) {
  const results: Array<{ url: string; title: string; snippet: string }> = [];
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

    const snippet = stripHtml(html.slice(match.index, match.index + 420));
    results.push({
      url: normalizedUrl,
      title,
      snippet,
    });
  }

  return results.filter(
    (candidate, index, collection) =>
      collection.findIndex((current) => current.url === candidate.url) === index,
  );
}

function scoreSearchCandidate(company: Company, candidate: { url: string; title: string; snippet: string }) {
  const companyTokens = buildCompanyTokens(company);
  const url = new URL(candidate.url);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const haystack = `${candidate.title} ${candidate.snippet} ${host}`.toLowerCase();
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const phoneMatch =
    phoneDigits && candidate.snippet.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7));
  let score = 0;
  const signals: string[] = [];

  const tokenMatches = companyTokens.filter((token) => haystack.includes(token));
  score += tokenMatches.length * 12;

  if (tokenMatches.length >= Math.min(2, companyTokens.length)) {
    signals.push("Candidate mentions the company name");
  }

  if (haystack.includes(company.location.city.toLowerCase())) {
    score += 10;
    signals.push("Candidate matches the company city");
  }

  if (haystack.includes(company.location.state.toLowerCase())) {
    score += 6;
    signals.push("Candidate matches the company state");
  }

  if (phoneMatch) {
    score += 16;
    signals.push("Candidate matches the imported phone number");
  }

  if ((companyTokens[0] ?? "").length > 0 && host.includes(companyTokens[0] ?? "")) {
    score += 10;
    signals.push("Domain lines up with the business name");
  }

  return {
    score,
    signals,
  };
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

function verifyCandidateHomepage(company: Company, html: string) {
  const text = stripHtml(html).toLowerCase();
  const companyTokens = buildCompanyTokens(company);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const street = company.location.streetAddress?.toLowerCase();
  let score = 0;
  const signals: string[] = [];

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
    score += 6;
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

  return {
    score,
    signals,
  };
}

function createDiscoverySnapshot(params: {
  now: string;
  status: CompanyWebsiteDiscoverySnapshot["status"];
  confidenceScore: number;
  discoveredWebsite?: string;
  candidateUrls?: string[];
  matchedSignals?: string[];
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
  return createDiscoverySnapshot({
    now: params.now,
    status: params.status ?? "record_provided",
    confidenceScore: 92,
    discoveredWebsite: normalizeWebsiteUrl(params.website) ?? params.website,
    candidateUrls: [
      normalizeWebsiteUrl(params.website) ?? params.website,
    ],
    matchedSignals: params.matchedSignals ?? ["Website was already present on the lead record"],
    source: params.source,
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

  const query = [
    `"${company.name}"`,
    company.location.streetAddress,
    company.location.city,
    company.location.state,
    company.presence.primaryPhone,
    "official site",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const response = await fetch(
      `${SEARCH_ENGINE_URL}?q=${encodeURIComponent(query)}`,
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
    const candidates = extractSearchCandidates(html)
      .map((candidate) => {
        const scored = scoreSearchCandidate(company, candidate);

        return {
          ...candidate,
          ...scored,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    if (candidates.length === 0) {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confidenceScore: 0,
        matchedSignals: ["No credible website candidates were found from open-web search"],
        source: createDiscoverySource(now, undefined),
      });
    }

    const verifiedCandidates = await Promise.all(
      candidates.slice(0, 3).map(async (candidate) => {
        try {
          const homepageHtml = await fetchCandidateHomepage(candidate.url);
          const homepageScore = verifyCandidateHomepage(company, homepageHtml);

          return {
            ...candidate,
            score: candidate.score + homepageScore.score,
            signals: dedupeStrings([...candidate.signals, ...homepageScore.signals]),
          };
        } catch {
          return candidate;
        }
      }),
    );

    const bestCandidate = [...verifiedCandidates].sort(
      (left, right) => right.score - left.score,
    )[0];

    if (!bestCandidate || bestCandidate.score < 40) {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confidenceScore: bestCandidate?.score ?? 0,
        candidateUrls: candidates.map((candidate) => candidate.url),
        matchedSignals: bestCandidate?.signals ?? [
          "Search produced results, but none were strong enough to auto-apply",
        ],
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
      source: createDiscoverySource(now, bestCandidate.url),
    });
  } catch (error) {
    return createDiscoverySnapshot({
      now,
      status: "failed",
      confidenceScore: 0,
      matchedSignals: ["Open-web discovery failed before a candidate could be verified"],
      lastError: error instanceof Error ? error.message : "Website discovery failed unexpectedly.",
      source: createDiscoverySource(now, undefined),
    });
  }
}
