import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type { Company } from "@/lib/domain";
import type {
  WebsiteDiscoveryCandidate,
  WebsiteDiscoveryDiscardedCandidate,
  WebsiteDiscoveryProviderAdapter,
  WebsiteDiscoverySearchQuery,
} from "@/lib/data/enrichment/discovery-providers/types";

const SEARCH_ENGINE_URL = "https://duckduckgo.com/html/";
const SEARCH_RESULT_LINK_CLASS_PATTERN = /\b(result__a|result-link(?:--result)?|result-link)\b/i;
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

function summarizeDiscardedCandidate(
  candidate: WebsiteDiscoveryDiscardedCandidate,
) {
  const titleSuffix = candidate.title ? ` [${candidate.title}]` : "";
  const normalizedSuffix = candidate.normalizedUrl
    ? ` -> ${candidate.normalizedUrl}`
    : "";

  return `"${candidate.rawUrl}"${normalizedSuffix} (${candidate.reason}) from ${candidate.queryLabel}${titleSuffix}`;
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

function looksLikeBareDomain(value: string) {
  return /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#].*)?$/i.test(
    value,
  );
}

function tryDecodeUrlComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildSearchProviderRedirectResult(
  resolvedUrl: URL,
  searchProviderLabel: string,
) {
  const redirected =
    resolvedUrl.searchParams.get("uddg") ??
    resolvedUrl.searchParams.get("rut") ??
    resolvedUrl.searchParams.get("u");

  if (!redirected) {
    return {
      rejectionReason: `${searchProviderLabel} result pointed back to an internal wrapper page instead of a destination site.`,
    };
  }

  return {
    candidateUrl: tryDecodeUrlComponent(redirected),
    acceptanceReason: `Unwrapped ${searchProviderLabel} redirect to the destination website.`,
  };
}

function resolveCandidateHref(rawUrl: string) {
  const decoded = decodeHtmlEntities(rawUrl).trim();

  if (!decoded) {
    return {
      rejectionReason: "Search result href was empty.",
    };
  }

  if (/^(?:javascript|mailto|tel|sms|data):/i.test(decoded)) {
    return {
      rejectionReason: "Search result href used a non-website protocol.",
    };
  }

  if (looksLikeBareDomain(decoded)) {
    return {
      candidateUrl: decoded,
      acceptanceReason: "Accepted a plausible bare-domain destination from search results.",
    };
  }

  if (decoded.startsWith("//")) {
    return resolveCandidateHref(`https:${decoded}`);
  }

  try {
    const resolved = new URL(decoded, SEARCH_ENGINE_URL);
    const normalizedHost = resolved.hostname.replace(/^www\./, "").toLowerCase();

    if (normalizedHost === "duckduckgo.com") {
      return buildSearchProviderRedirectResult(resolved, "DuckDuckGo");
    }

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return {
        rejectionReason: "Search result href did not resolve to an HTTP website.",
      };
    }

    if (/^https?:\/\//i.test(decoded)) {
      return {
        candidateUrl: resolved.toString(),
        acceptanceReason: "Accepted a direct destination website from search results.",
      };
    }

    if (decoded.startsWith("/")) {
      return {
        rejectionReason: "Search result href pointed to a search-provider internal path instead of a destination site.",
      };
    }

    return {
      rejectionReason: "Search result href could not be confirmed as a destination website.",
    };
  } catch {
    return {
      rejectionReason: "Search result href could not be parsed.",
    };
  }
}

function normalizeCandidateUrl(rawUrl: string) {
  const resolved = resolveCandidateHref(rawUrl);

  if (!resolved.candidateUrl) {
    return {
      rejectionReason: resolved.rejectionReason ?? "Candidate URL could not be resolved.",
    };
  }

  try {
    const normalized = normalizeWebsiteUrl(resolved.candidateUrl);

    if (!normalized) {
      return {
        rejectionReason: "Candidate URL did not normalize to a plausible public website.",
      };
    }

    const url = new URL(normalized);

    return {
      candidateUrl: resolved.candidateUrl,
      normalizedUrl: `${url.protocol}//${url.host.toLowerCase()}`,
      acceptanceReason:
        resolved.acceptanceReason ??
        "Accepted a plausible destination website after normalization.",
    };
  } catch {
    return {
      rejectionReason: "Candidate URL could not be normalized.",
    };
  }
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

function extractStreetQueryFragment(streetAddress: string | undefined) {
  if (!streetAddress) {
    return undefined;
  }

  const fragment = streetAddress
    .split(",")[0]
    ?.replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .slice(0, 5)
    .join(" ");

  return fragment || undefined;
}

function buildDiscoveryQueries(company: Company) {
  const profileTokens = extractReferenceTokens(
    company.presence.googleBusinessProfileUrl,
  ).slice(0, 3);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const phoneFragment =
    phoneDigits && phoneDigits.length >= 7 ? phoneDigits.slice(-10) : undefined;
  const streetFragment = extractStreetQueryFragment(company.location.streetAddress);
  const queryVariants: Array<WebsiteDiscoverySearchQuery | undefined> = [
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
    phoneFragment
      ? {
          label: "business name + location + phone",
          value: [
            `"${company.name}"`,
            company.location.city,
            company.location.state,
            phoneFragment,
            "contact",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : undefined,
    streetFragment
      ? {
          label: "business name + street + location",
          value: [
            `"${company.name}"`,
            streetFragment,
            company.location.city,
            company.location.state,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : undefined,
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
    (variant, index, collection): variant is WebsiteDiscoverySearchQuery => {
      if (!variant?.value.length) {
        return false;
      }

      return collection.findIndex((current) => current?.value === variant.value) === index;
    },
  );
}

function readAttribute(
  attributes: string,
  attributeName: string,
) {
  const pattern = new RegExp(`${attributeName}=(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, "i");

  const match = pattern.exec(attributes);

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function extractResultSnippet(html: string, startIndex: number) {
  const searchWindow = html.slice(startIndex, startIndex + 1_200);
  const snippetMatch = /class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i.exec(
    searchWindow,
  );

  if (snippetMatch?.[1]) {
    return stripHtml(snippetMatch[1]);
  }

  return stripHtml(searchWindow).slice(0, 280);
}

export function extractSearchCandidatesFromHtml(html: string, queryLabel: string) {
  const results: WebsiteDiscoveryCandidate[] = [];
  const discardedCandidates: WebsiteDiscoveryDiscardedCandidate[] = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const attributes = match[1] ?? "";
    const className = readAttribute(attributes, "class") ?? "";

    if (!SEARCH_RESULT_LINK_CLASS_PATTERN.test(className)) {
      continue;
    }

    const rawHref = readAttribute(attributes, "href") ?? "";
    const title = stripHtml(match[2] ?? "");
    const normalizedCandidate = normalizeCandidateUrl(rawHref);

    if (!normalizedCandidate.normalizedUrl) {
      discardedCandidates.push({
        rawUrl: rawHref,
        title: title || undefined,
        queryLabel,
        reason:
          normalizedCandidate.rejectionReason ??
          "Candidate URL could not be normalized.",
      });
      continue;
    }

    if (isBlockedDomain(normalizedCandidate.normalizedUrl)) {
      discardedCandidates.push({
        rawUrl: rawHref,
        normalizedUrl: normalizedCandidate.normalizedUrl,
        title: title || undefined,
        queryLabel,
        reason: "Candidate resolved to a blocked directory, listing, or search domain.",
      });
      continue;
    }

    if (title.length < 3) {
      continue;
    }

    const snippet = extractResultSnippet(html, match.index);
    results.push({
      rawUrl: rawHref,
      normalizedUrl: normalizedCandidate.normalizedUrl,
      url: normalizedCandidate.normalizedUrl,
      title,
      snippet,
      queryLabel,
      acceptanceReason:
        normalizedCandidate.acceptanceReason ??
        "Accepted a plausible destination website from search results.",
    });
  }

  return {
    candidates: results.filter(
      (candidate, index, collection) =>
        collection.findIndex((current) => current.url === candidate.url) === index,
    ),
    discardedCandidates,
  };
}

async function fetchSearchCandidatesForQuery(query: WebsiteDiscoverySearchQuery) {
  const response = await fetch(
    `${SEARCH_ENGINE_URL}?q=${encodeURIComponent(query.value)}`,
    {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "user-agent":
          "GoPinion Outbound OS website discovery bot (+https://gopinion.ai)",
        accept: "text/html,application/xhtml+xml",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  return extractSearchCandidatesFromHtml(html, query.label);
}

export const openWebWebsiteDiscoveryProvider: WebsiteDiscoveryProviderAdapter = {
  provider: "open_web",
  label: "Open-web search discovery",
  async search(company) {
    const queries = buildDiscoveryQueries(company);
    const settledSearches = await Promise.allSettled(
      queries.map((query) => fetchSearchCandidatesForQuery(query)),
    );
    const discardedCandidates = settledSearches.flatMap((result) =>
      result.status === "fulfilled" ? result.value.discardedCandidates : [],
    );

    if (discardedCandidates.length > 0) {
      const preview = discardedCandidates
        .slice(0, 5)
        .map((candidate) => summarizeDiscardedCandidate(candidate))
        .join("; ");

      console.warn(
        `[website-discovery/open-web] Discarded ${discardedCandidates.length} malformed or blocked candidate URL(s): ${preview}`,
      );
    }

    return {
      provider: "open_web",
      providerLabel: "Open-web search discovery",
      queries,
      candidates: settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value.candidates : [],
      ),
      discardedCandidates,
      errors: settledSearches.flatMap((result) =>
        result.status === "rejected"
          ? [result.reason instanceof Error ? result.reason.message : "Search fetch failed"]
          : [],
      ),
    };
  },
};
