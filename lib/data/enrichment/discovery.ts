import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import {
  createWebsiteDiscoveryProvider,
  type WebsiteDiscoveryCandidate,
} from "@/lib/data/enrichment/discovery-provider";
import {
  extractLikelyInternalPageCandidates,
  getSupportingPageUrlsByKind,
  type SupportingPageCandidate,
} from "@/lib/data/enrichment/site-pages";
import type {
  Company,
  PreferredSupportingPageSource,
  CompanyWebsiteDiscoverySnapshot,
  EnrichmentConfidenceLevel,
  SourceReference,
} from "@/lib/domain";

const DIRECTORY_HINT_PATTERNS = [
  /\bdirectory\b/i,
  /\blisting\b/i,
  /\breviews?\b/i,
  /\bnear me\b/i,
  /\bclassifieds?\b/i,
  /\bmarketplace\b/i,
];

interface ScoredSearchCandidate extends WebsiteDiscoveryCandidate {
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

function createDiscoverySource(
  now: string,
  params: {
    url?: string;
    provider?: string;
    label?: string;
  } = {},
): SourceReference {
  return {
    kind: "provider",
    provider: params.provider ?? "website_discovery_open_web",
    label: params.label ?? "Open-web website discovery",
    url: params.url,
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

const AUTO_CONFIRM_MIN_SCORE = 68;
const REVIEW_CANDIDATE_MIN_SCORE = 42;

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

function buildDealershipPhrases(company: Company) {
  const normalizedName = company.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const city = company.location.city.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const state = company.location.state.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const brandToken = buildCompanyTokens(company).slice(-1)[0];

  return dedupeStrings([
    normalizedName,
    brandToken && city ? `${brandToken} ${city}` : undefined,
    brandToken && city ? `${city} ${brandToken}` : undefined,
    brandToken && city ? `${brandToken} of ${city}` : undefined,
    brandToken && state ? `${brandToken} ${state}` : undefined,
    brandToken && state ? `${brandToken} dealership ${city}` : undefined,
  ]);
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

function looksLikeDirectoryCandidate(candidate: { title: string; snippet: string; url: string }) {
  const haystack = `${candidate.title} ${candidate.snippet} ${candidate.url}`.toLowerCase();

  return DIRECTORY_HINT_PATTERNS.some((pattern) => pattern.test(haystack));
}

function getHostnameSignals(host: string) {
  return host
    .replace(/^www\./, "")
    .replace(/\.[a-z]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildConfirmationReason(params: {
  confirmationStatus: CompanyWebsiteDiscoverySnapshot["confirmationStatus"];
  confidenceScore: number;
  candidateWebsite?: string;
  matchedSignals?: string[];
  lastError?: string;
  operatorReview?: CompanyWebsiteDiscoverySnapshot["operatorReview"];
}) {
  switch (params.confirmationStatus) {
    case "record_provided":
      return "Website was already on the company record.";
    case "auto_confirmed":
      return `Candidate cleared the auto-confirm threshold at ${Math.round(
        params.confidenceScore,
      )}/100 using strong business, location, and site signals.`;
    case "operator_confirmed":
      return (
        params.operatorReview?.note ??
        `Operator confirmed ${params.operatorReview?.officialWebsite ?? params.candidateWebsite ?? "the candidate website"} as the official site.`
      );
    case "needs_review":
      return `Candidate scored ${Math.round(
        params.confidenceScore,
      )}/100, which is promising but still below the auto-confirm threshold of ${AUTO_CONFIRM_MIN_SCORE}/100.`;
    case "rejected":
      return (
        params.operatorReview?.note ??
        `Operator rejected ${params.candidateWebsite ?? "the candidate website"} as the official site.`
      );
    case "failed":
      return params.lastError ?? "Search-backed website discovery failed before a candidate could be verified.";
    case "not_found":
    default:
      return params.matchedSignals?.[0] ?? "No candidate was strong enough to confirm automatically.";
  }
}

function scoreSearchCandidate(
  company: Company,
  candidate: WebsiteDiscoveryCandidate,
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
  const streetFragment = company.location.streetAddress
    ?.split(",")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const hostnameSignals = getHostnameSignals(host);
  const dealershipPhrases = buildDealershipPhrases(company);
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

  if (streetFragment && haystack.includes(streetFragment)) {
    score += 10;
    signals.push("Candidate references the imported street address");
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

  const dealershipPhraseMatches = dealershipPhrases.filter(
    (phrase) => haystack.includes(phrase) || hostnameSignals.includes(phrase),
  );

  if (dealershipPhraseMatches.length > 0) {
    score += 12;
    signals.push("Candidate matches a dealership-style brand/location naming pattern");
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
  candidateWebsite?: string;
  confirmationStatus?: CompanyWebsiteDiscoverySnapshot["confirmationStatus"];
  confirmationReason?: string;
  candidateUrls?: string[];
  matchedSignals?: string[];
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  preferredSupportingPage?: CompanyWebsiteDiscoverySnapshot["preferredSupportingPage"];
  operatorReview?: CompanyWebsiteDiscoverySnapshot["operatorReview"];
  lastError?: string;
  source?: SourceReference;
}) {
  const confirmationStatus =
    params.confirmationStatus ??
    (params.status === "record_provided"
      ? "record_provided"
      : params.status === "discovered"
        ? "auto_confirmed"
        : params.status === "failed"
          ? "failed"
          : params.candidateWebsite
            ? "needs_review"
            : "not_found");
  return {
    status: params.status,
    confirmationStatus,
    confirmationReason:
      params.confirmationReason ??
      buildConfirmationReason({
        confirmationStatus,
        confidenceScore: params.confidenceScore,
        candidateWebsite: params.candidateWebsite ?? params.discoveredWebsite,
        matchedSignals: params.matchedSignals,
        lastError: params.lastError,
        operatorReview: params.operatorReview,
      }),
    confidenceLevel: getConfidenceLevel(params.confidenceScore),
    confidenceScore: Math.max(0, Math.min(100, Math.round(params.confidenceScore))),
    discoveredWebsite: params.discoveredWebsite,
    candidateWebsite: params.candidateWebsite ?? params.discoveredWebsite,
    candidateUrls: params.candidateUrls ?? [],
    matchedSignals: params.matchedSignals ?? [],
    supportingPageUrls: params.supportingPageUrls ?? [],
    contactPageUrls: params.contactPageUrls ?? [],
    staffPageUrls: params.staffPageUrls ?? [],
    extractedEvidence: params.extractedEvidence ?? [],
    preferredSupportingPage: params.preferredSupportingPage,
    operatorReview: params.operatorReview,
    source:
      params.source ??
      createDiscoverySource(params.now, {
        url: params.discoveredWebsite ?? params.candidateWebsite,
      }),
    lastCheckedAt: params.now,
    lastError: params.lastError,
  } satisfies CompanyWebsiteDiscoverySnapshot;
}

function buildPreferredSupportingPageReason(params: {
  kind: NonNullable<CompanyWebsiteDiscoverySnapshot["preferredSupportingPage"]>["kind"];
  source: PreferredSupportingPageSource;
  extractedEvidence?: string[];
}) {
  if (params.source === "operator_confirmed") {
    return "Operator confirmed this supporting page for future enrichment runs.";
  }

  const evidence = params.extractedEvidence?.find((value) =>
    /named contact|staff\/team page|contact page|email path/i.test(value),
  );

  switch (params.kind) {
    case "staff":
      return evidence ?? "Discovery found a staff/team page with likely decision-maker clues.";
    case "contact":
      return evidence ?? "Discovery found a contact page with a likely outreach path.";
    case "about":
    default:
      return evidence ?? "Discovery found a supporting page worth reusing during future enrichment.";
  }
}

export function selectPreferredSupportingPage(params: {
  now: string;
  current?: CompanyWebsiteDiscoverySnapshot["preferredSupportingPage"];
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  source?: PreferredSupportingPageSource;
}) {
  if (
    params.current?.source === "operator_confirmed" &&
    params.source !== "operator_confirmed"
  ) {
    return params.current;
  }

  const source = params.source ?? "discovery";
  const kind =
    params.staffPageUrls?.[0] ? "staff" : params.contactPageUrls?.[0] ? "contact" : params.supportingPageUrls?.[0] ? "about" : undefined;
  const url =
    (kind === "staff" ? params.staffPageUrls?.[0] : undefined) ??
    (kind === "contact" ? params.contactPageUrls?.[0] : undefined) ??
    params.supportingPageUrls?.[0] ??
    params.current?.url;

  if (!url || !kind) {
    return params.current;
  }

  if (
    params.current?.url === url &&
    params.current.kind === kind &&
    params.current.source === source
  ) {
    return {
      ...params.current,
      reason:
        params.current.reason ||
        buildPreferredSupportingPageReason({
          kind,
          source,
          extractedEvidence: params.extractedEvidence,
        }),
      updatedAt: params.now,
    };
  }

  return {
    url,
    kind,
    source,
    reason: buildPreferredSupportingPageReason({
      kind,
      source,
      extractedEvidence: params.extractedEvidence,
    }),
    updatedAt: params.now,
  } satisfies NonNullable<CompanyWebsiteDiscoverySnapshot["preferredSupportingPage"]>;
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
    confirmationStatus: "record_provided",
    confidenceScore: 92,
    discoveredWebsite: normalizedWebsite,
    candidateWebsite: normalizedWebsite,
    candidateUrls: [normalizedWebsite],
    matchedSignals:
      params.matchedSignals ?? ["Website was already present on the lead record"],
    confirmationReason: params.matchedSignals?.[0],
    supportingPageUrls: [],
    contactPageUrls: [],
    staffPageUrls: [],
    extractedEvidence: [],
    preferredSupportingPage: undefined,
    operatorReview: undefined,
    source: params.source,
  });
}

export function mergeWebsiteDiscoveryEvidence(params: {
  snapshot: CompanyWebsiteDiscoverySnapshot;
  now: string;
  status?: CompanyWebsiteDiscoverySnapshot["status"];
  discoveredWebsite?: string;
  candidateWebsite?: string;
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  preferredSupportingPage?: CompanyWebsiteDiscoverySnapshot["preferredSupportingPage"];
  confirmationStatus?: CompanyWebsiteDiscoverySnapshot["confirmationStatus"];
  confirmationReason?: string;
  operatorReview?: CompanyWebsiteDiscoverySnapshot["operatorReview"];
  lastError?: string;
}) {
  return createDiscoverySnapshot({
    now: params.now,
    status: params.status ?? params.snapshot.status,
    confirmationStatus:
      params.confirmationStatus ?? params.snapshot.confirmationStatus,
    confidenceScore: params.snapshot.confidenceScore,
    discoveredWebsite:
      params.discoveredWebsite ?? params.snapshot.discoveredWebsite,
    candidateWebsite:
      params.candidateWebsite ??
      params.snapshot.candidateWebsite ??
      params.snapshot.discoveredWebsite,
    confirmationReason:
      params.confirmationReason ?? params.snapshot.confirmationReason,
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
    preferredSupportingPage:
      params.preferredSupportingPage ?? params.snapshot.preferredSupportingPage,
    operatorReview: params.operatorReview ?? params.snapshot.operatorReview,
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

  try {
    const provider = createWebsiteDiscoveryProvider();
    const searchRun = await provider.search(company);
    const searchSource = createDiscoverySource(now, {
      provider: `website_discovery_${searchRun.provider}`,
      label: searchRun.providerLabel,
    });
    const mergedCandidates = new Map<string, ScoredSearchCandidate>();

    for (const candidate of searchRun.candidates) {
      const scored = scoreSearchCandidate(company, candidate);
      const nextCandidate = {
        ...candidate,
        score: scored.score,
        signals: scored.signals,
        supportingPageCandidates: [],
        extractedEvidence: [],
      } satisfies ScoredSearchCandidate;
      const existing = mergedCandidates.get(candidate.url);

      if (!existing || nextCandidate.score > existing.score) {
        mergedCandidates.set(candidate.url, nextCandidate);
      } else {
        mergedCandidates.set(candidate.url, {
          ...existing,
          signals: dedupeStrings([...existing.signals, ...nextCandidate.signals]),
        });
      }
    }

    const candidates = [...mergedCandidates.values()]
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    if (candidates.length === 0) {
      return createDiscoverySnapshot({
        now,
        status: searchRun.errors.length > 0 ? "failed" : "not_found",
        confirmationStatus: searchRun.errors.length > 0 ? "failed" : "not_found",
        confidenceScore: 0,
        matchedSignals: [
          searchRun.errors.length > 0
            ? "Search-backed website discovery failed before a candidate could be verified"
            : "No credible website candidates were found from search-backed discovery",
        ],
        lastError: searchRun.errors[0],
        source: searchSource,
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
        confirmationStatus:
          (bestCandidate?.score ?? 0) >= REVIEW_CANDIDATE_MIN_SCORE
            ? "needs_review"
            : "not_found",
        confidenceScore: bestCandidate?.score ?? 0,
        candidateWebsite: bestCandidate?.url,
        candidateUrls: candidates.map((candidate) => candidate.url),
        matchedSignals: bestCandidate?.signals ?? [
          "Search produced results, but none were strong enough to auto-apply",
        ],
        supportingPageUrls: dedupeStrings(
          bestCandidate?.supportingPageCandidates.map((candidate) => candidate.url) ?? [],
        ),
        contactPageUrls: dedupeStrings(
          getSupportingPageUrlsByKind(
            bestCandidate?.supportingPageCandidates ?? [],
            "contact",
          ),
        ),
        staffPageUrls: dedupeStrings(
          getSupportingPageUrlsByKind(
            bestCandidate?.supportingPageCandidates ?? [],
            "staff",
          ),
        ),
        extractedEvidence: bestCandidate?.extractedEvidence ?? [],
        source: createDiscoverySource(now, {
          url: bestCandidate?.url,
          provider: searchSource.provider,
          label: searchSource.label,
        }),
      });
    }

    if (bestCandidate.score < AUTO_CONFIRM_MIN_SCORE) {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confirmationStatus: "needs_review",
        confidenceScore: bestCandidate.score,
        candidateWebsite: bestCandidate.url,
        candidateUrls: candidates.map((candidate) => candidate.url),
        matchedSignals: dedupeStrings([
          ...bestCandidate.signals,
          "Best website candidate needs operator review before auto-confirmation.",
        ]),
        supportingPageUrls: dedupeStrings(
          bestCandidate.supportingPageCandidates.map((candidate) => candidate.url),
        ),
        contactPageUrls: dedupeStrings(
          getSupportingPageUrlsByKind(bestCandidate.supportingPageCandidates, "contact"),
        ),
        staffPageUrls: dedupeStrings(
          getSupportingPageUrlsByKind(bestCandidate.supportingPageCandidates, "staff"),
        ),
        extractedEvidence: bestCandidate.extractedEvidence,
        source: createDiscoverySource(now, {
          url: bestCandidate.url,
          provider: searchSource.provider,
          label: searchSource.label,
        }),
      });
    }

    return createDiscoverySnapshot({
      now,
      status: "discovered",
      confirmationStatus: "auto_confirmed",
      confidenceScore: bestCandidate.score,
      discoveredWebsite: bestCandidate.url,
      candidateWebsite: bestCandidate.url,
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
      source: createDiscoverySource(now, {
        url: bestCandidate.url,
        provider: searchSource.provider,
        label: searchSource.label,
      }),
    });
  } catch (error) {
    return createDiscoverySnapshot({
      now,
      status: "failed",
      confirmationStatus: "failed",
      confidenceScore: 0,
      matchedSignals: [
        "Search-backed website discovery failed before a candidate could be verified",
      ],
      lastError:
        error instanceof Error
          ? error.message
          : "Website discovery failed unexpectedly.",
      source: createDiscoverySource(now),
    });
  }
}
