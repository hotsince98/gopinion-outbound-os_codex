import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type { Company } from "@/lib/domain";
import type {
  WebsiteDiscoveryCandidate,
  WebsiteDiscoveryCandidateDiagnostic,
  WebsiteDiscoveryDiscardedCandidate,
  WebsiteDiscoveryProviderAdapter,
  WebsiteDiscoverySearchQuery,
} from "@/lib/data/enrichment/discovery-providers/types";

const SEARCH_ENGINE_URL = "https://duckduckgo.com/html/";
const SEARCH_RESULT_LINK_CLASS_PATTERN = /\b(result__a|result-link(?:--result)?|result-link)\b/i;
const SEARCH_RESULT_VISIBLE_URL_CLASS_PATTERN =
  /\b(result__url|result__extras__url|result__badge__url|result__domain)\b/i;
const SEARCH_PROVIDER_HOSTS = ["duckduckgo.com", "google.com", "bing.com"];
const SEARCH_PROVIDER_REDIRECT_QUERY_PARAMS = [
  "uddg",
  "rut",
  "u",
  "url",
  "target",
  "dest",
  "destination",
  "redirect_url",
  "redirect",
  "rd",
  "to",
] as const;
const SEARCH_RESULT_ATTRIBUTE_CANDIDATES = [
  "href",
  "data-href",
  "data-url",
  "data-result",
  "data-destination",
  "data-redirect",
] as const;
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

function isSearchProviderHost(hostname: string) {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();

  return SEARCH_PROVIDER_HOSTS.some(
    (providerHost) =>
      normalizedHost === providerHost || normalizedHost.endsWith(`.${providerHost}`),
  );
}

function extractInlineDestination(value: string) {
  const decoded = tryDecodeUrlComponent(decodeHtmlEntities(value));
  const embeddedUrlMatch = decoded.match(/https?:\/\/[^\s"'<>]+/i);

  if (embeddedUrlMatch?.[0]) {
    return embeddedUrlMatch[0];
  }

  const bareDomainMatch = decoded.match(
    /(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s"'<>]*)?/i,
  );

  return bareDomainMatch?.[0];
}

function extractVisibleUrlCandidate(value: string) {
  const cleaned = stripHtml(value)
    .replace(/[›»]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return undefined;
  }

  return extractInlineDestination(cleaned);
}

function extractVisibleUrlCandidates(resultHtml: string) {
  const candidates: Array<string | undefined> = [];
  const taggedElementPattern = /<(?:a|span|div)\b([^>]*)>([\s\S]*?)<\/(?:a|span|div)>/gi;
  let match: RegExpExecArray | null;

  while ((match = taggedElementPattern.exec(resultHtml))) {
    const attributes = match[1] ?? "";
    const className = readAttribute(attributes, "class") ?? "";

    if (!SEARCH_RESULT_VISIBLE_URL_CLASS_PATTERN.test(className)) {
      continue;
    }

    candidates.push(extractVisibleUrlCandidate(match[2] ?? ""));
  }

  const citePattern = /<cite\b[^>]*>([\s\S]*?)<\/cite>/gi;

  while ((match = citePattern.exec(resultHtml))) {
    candidates.push(extractVisibleUrlCandidate(match[1] ?? ""));
  }

  return dedupeStrings(candidates);
}

function extractRawCandidateValues(attributes: string, resultHtml: string) {
  return dedupeStrings([
    ...SEARCH_RESULT_ATTRIBUTE_CANDIDATES.map((attributeName) =>
      readAttribute(attributes, attributeName),
    ),
    ...extractVisibleUrlCandidates(resultHtml),
  ]);
}

function buildSearchProviderRedirectResult(
  resolvedUrl: URL,
  searchProviderLabel: string,
) {
  const redirected = SEARCH_PROVIDER_REDIRECT_QUERY_PARAMS
    .map((paramName) => resolvedUrl.searchParams.get(paramName))
    .find((value): value is string => Boolean(value?.trim()));

  if (!redirected) {
    const nestedDestination = dedupeStrings([
      ...Array.from(resolvedUrl.searchParams.values()).map((value) =>
        extractInlineDestination(value),
      ),
      extractInlineDestination(resolvedUrl.toString()),
    ]).find((candidate) => {
      try {
        const parsed = new URL(
          looksLikeBareDomain(candidate) ? `https://${candidate}` : candidate,
        );

        return !isSearchProviderHost(parsed.hostname);
      } catch {
        return false;
      }
    });

    if (nestedDestination) {
      return {
        candidateUrl: nestedDestination,
        acceptanceReason: `Recovered a nested destination website from ${searchProviderLabel}'s redirect wrapper.`,
      };
    }

    return {
      rejectionReason: `${searchProviderLabel} result pointed back to an internal wrapper path (${resolvedUrl.pathname || "/"}) instead of a destination site.`,
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

    if (isSearchProviderHost(normalizedHost)) {
      return buildSearchProviderRedirectResult(
        resolved,
        normalizedHost.includes("duckduckgo")
          ? "DuckDuckGo"
          : normalizedHost.includes("google")
            ? "Google"
            : "Bing",
      );
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
      label: "business name + official website",
      value: [`"${company.name}"`, "official website"].filter(Boolean).join(" "),
    },
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
    phoneFragment && streetFragment
      ? {
          label: "business name + street + phone",
          value: [
            `"${company.name}"`,
            streetFragment,
            company.location.city,
            phoneFragment,
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
    profileTokens.length > 0 && phoneFragment
      ? {
          label: "business name + maps profile hints + phone",
          value: [
            `"${company.name}"`,
            company.location.city,
            company.location.state,
            ...profileTokens,
            phoneFragment,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : undefined,
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

function buildCandidateDiagnostic(params: {
  sourceType: WebsiteDiscoveryCandidate["sourceType"];
  sourceDetail?: string;
  isGenericGuess: boolean;
  rawCandidate: string;
  normalizedCandidate?: string;
  queryLabel: string;
  title?: string;
  decision: WebsiteDiscoveryCandidateDiagnostic["decision"];
  score?: number;
  strongSignalCount?: number;
  signalHits?: string[];
  signalMisses?: string[];
  reason: string;
}) {
  return {
    sourceType: params.sourceType,
    sourceDetail: params.sourceDetail,
    isGenericGuess: params.isGenericGuess,
    rawCandidate: params.rawCandidate,
    normalizedCandidate: params.normalizedCandidate,
    queryLabel: params.queryLabel,
    title: params.title,
    score: params.score ?? 0,
    strongSignalCount: params.strongSignalCount ?? 0,
    signalHits: params.signalHits ?? [],
    signalMisses: params.signalMisses ?? [],
    decision: params.decision,
    reason: params.reason,
  } satisfies WebsiteDiscoveryCandidateDiagnostic;
}

export function extractSearchCandidatesFromHtml(html: string, queryLabel: string) {
  const results: WebsiteDiscoveryCandidate[] = [];
  const candidateDiagnostics: WebsiteDiscoveryCandidateDiagnostic[] = [];
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
    if (title.length < 3) {
      continue;
    }

    const resultHtml = html.slice(match.index, match.index + 1_000);
    const rawCandidates = extractRawCandidateValues(attributes, resultHtml);

    if (rawCandidates.length === 0 && rawHref) {
      rawCandidates.push(rawHref);
    }

    const snippet = extractResultSnippet(html, match.index);
    const acceptedUrls = new Set<string>();

    for (const rawCandidate of rawCandidates) {
      const normalizedCandidate = normalizeCandidateUrl(rawCandidate);

      if (!normalizedCandidate.normalizedUrl) {
        const reason =
          normalizedCandidate.rejectionReason ??
          "Candidate URL could not be normalized.";

        discardedCandidates.push({
          rawUrl: rawCandidate,
          title: title || undefined,
          queryLabel,
          reason,
        });
        candidateDiagnostics.push(
          buildCandidateDiagnostic({
            sourceType: "search_result",
            sourceDetail: "open_web_search",
            isGenericGuess: false,
            rawCandidate,
            queryLabel,
            title: title || undefined,
            decision: "rejected",
            reason,
            signalMisses: [reason],
          }),
        );
        continue;
      }

      if (isBlockedDomain(normalizedCandidate.normalizedUrl)) {
        const reason =
          "Candidate resolved to a blocked directory, listing, or search domain.";

        discardedCandidates.push({
          rawUrl: rawCandidate,
          normalizedUrl: normalizedCandidate.normalizedUrl,
          title: title || undefined,
          queryLabel,
          reason,
        });
        candidateDiagnostics.push(
          buildCandidateDiagnostic({
            sourceType: "search_result",
            sourceDetail: "open_web_search",
            isGenericGuess: false,
            rawCandidate,
            normalizedCandidate: normalizedCandidate.normalizedUrl,
            queryLabel,
            title: title || undefined,
            decision: "rejected",
            reason,
            signalMisses: [reason],
          }),
        );
        continue;
      }

      candidateDiagnostics.push(
        buildCandidateDiagnostic({
          sourceType: "search_result",
          sourceDetail: "open_web_search",
          isGenericGuess: false,
          rawCandidate,
          normalizedCandidate: normalizedCandidate.normalizedUrl,
          queryLabel,
          title: title || undefined,
          decision: "accepted",
          reason:
            normalizedCandidate.acceptanceReason ??
            "Accepted a plausible destination website from search results.",
          signalHits: [
            normalizedCandidate.acceptanceReason ??
              "Accepted a plausible destination website from search results.",
          ],
        }),
      );

      if (acceptedUrls.has(normalizedCandidate.normalizedUrl)) {
        continue;
      }

      acceptedUrls.add(normalizedCandidate.normalizedUrl);
      results.push({
        rawUrl: rawCandidate,
        normalizedUrl: normalizedCandidate.normalizedUrl,
        url: normalizedCandidate.normalizedUrl,
        title,
        snippet,
        queryLabel,
        acceptanceReason:
          normalizedCandidate.acceptanceReason ??
          "Accepted a plausible destination website from search results.",
        sourceType: "search_result",
        sourceDetail: "open_web_search",
        isGenericGuess: false,
      });
    }
  }

  return {
    candidates: results.filter(
      (candidate, index, collection) =>
        collection.findIndex((current) => current.url === candidate.url) === index,
    ),
    candidateDiagnostics: candidateDiagnostics.filter(
      (candidate, index, collection) =>
        collection.findIndex(
          (current) =>
            current.rawCandidate === candidate.rawCandidate &&
            current.normalizedCandidate === candidate.normalizedCandidate &&
            current.queryLabel === candidate.queryLabel &&
            current.decision === candidate.decision &&
            current.reason === candidate.reason,
        ) === index,
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
      candidateDiagnostics: settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value.candidateDiagnostics : [],
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
