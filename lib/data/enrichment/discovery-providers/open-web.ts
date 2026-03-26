import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type { Company } from "@/lib/domain";
import type {
  WebsiteDiscoveryCandidate,
  WebsiteDiscoveryProviderAdapter,
  WebsiteDiscoverySearchQuery,
} from "@/lib/data/enrichment/discovery-providers/types";

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

function extractSearchCandidates(html: string, queryLabel: string) {
  const results: WebsiteDiscoveryCandidate[] = [];
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

  return extractSearchCandidates(html, query.label);
}

export const openWebWebsiteDiscoveryProvider: WebsiteDiscoveryProviderAdapter = {
  provider: "open_web",
  label: "Open-web search discovery",
  async search(company) {
    const queries = buildDiscoveryQueries(company);
    const settledSearches = await Promise.allSettled(
      queries.map((query) => fetchSearchCandidatesForQuery(query)),
    );

    return {
      provider: "open_web",
      providerLabel: "Open-web search discovery",
      queries,
      candidates: settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
      errors: settledSearches.flatMap((result) =>
        result.status === "rejected"
          ? [result.reason instanceof Error ? result.reason.message : "Search fetch failed"]
          : [],
      ),
    };
  },
};
