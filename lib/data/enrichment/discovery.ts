import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import {
  createWebsiteDiscoveryProvider,
  type WebsiteDiscoveryCandidate,
  type WebsiteDiscoveryCandidateDiagnostic,
} from "@/lib/data/enrichment/discovery-provider";
import {
  extractLikelyInternalPageCandidates,
  getSupportingPageUrlsByKind,
  type SupportingPageCandidate,
  type SupportingPageKind,
} from "@/lib/data/enrichment/site-pages";
import type {
  Company,
  PreferredSupportingPageSource,
  CompanyWebsiteDiscoverySnapshot,
  EnrichmentConfidenceLevel,
  SourceReference,
} from "@/lib/domain";
import type { WebsiteDiscoveryCandidateVerificationStage } from "@/lib/data/enrichment/discovery-providers/types";
import type { WebsiteDiscoveryVerificationFailureKind } from "@/lib/data/enrichment/discovery-providers/types";

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
  signalHits: string[];
  signalMisses: string[];
  strongSignalCount: number;
  supportingPageCandidates: SupportingPageCandidate[];
  extractedEvidence: string[];
  verificationStage: WebsiteDiscoveryCandidateVerificationStage;
  verificationAttemptedUrl?: string;
  verificationAttemptUrls: string[];
  verificationResolvedUrl?: string;
  canonicalVerifiedUrl?: string;
  resolvedUrlBecameCanonical: boolean;
  canonicalRetrySucceeded: boolean;
  verificationFailureKind?: WebsiteDiscoveryVerificationFailureKind;
  verificationFailureDetail?: string;
  verificationPageUrls: string[];
  verificationEvidence: string[];
}

type CandidateSignalStrength = "strong" | "supporting";

interface CandidateSignalEvaluation {
  label: string;
  detail: string;
  strength: CandidateSignalStrength;
  matched: boolean;
  scoreDelta: number;
}

interface CandidateSignalSummary {
  score: number;
  signals: string[];
  signalHits: string[];
  signalMisses: string[];
  strongSignalCount: number;
}

interface CandidateVerificationResult extends CandidateSignalSummary {
  supportingPageCandidates: SupportingPageCandidate[];
  extractedEvidence: string[];
  verificationStage: WebsiteDiscoveryCandidateVerificationStage;
  verificationAttemptedUrl?: string;
  verificationAttemptUrls: string[];
  verificationResolvedUrl?: string;
  canonicalVerifiedUrl?: string;
  resolvedUrlBecameCanonical: boolean;
  canonicalRetrySucceeded: boolean;
  verificationFailureKind?: WebsiteDiscoveryVerificationFailureKind;
  verificationFailureDetail?: string;
  verificationPageUrls: string[];
  verificationEvidence: string[];
}

interface CandidatePageFetchResult {
  html: string;
  attemptedUrl: string;
  attemptedUrls: string[];
  resolvedUrl: string;
  canonicalUrl: string;
  resolvedUrlBecameCanonical: boolean;
  canonicalRetrySucceeded: boolean;
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

const DISCARD_CANDIDATE_MIN_SCORE = 30;
const CONDITIONAL_AUTO_CONFIRM_MIN_SCORE = 50;
const AUTO_CONFIRM_MIN_SCORE = 68;
const LIGHTWEIGHT_VERIFICATION_MIN_SCORE = DISCARD_CANDIDATE_MIN_SCORE;
const LIGHTWEIGHT_VERIFICATION_MAX_SCORE =
  CONDITIONAL_AUTO_CONFIRM_MIN_SCORE - 1;
const LIGHTWEIGHT_VERIFICATION_PAGE_LIMIT = 2;
const DIRECT_DOMAIN_REQUIRED_STRONG_SIGNALS = 2;
const GENERIC_DIRECT_DOMAIN_REQUIRED_STRONG_SIGNALS = 3;
const DOMAIN_NOISE_WORDS = new Set([
  "auto",
  "autos",
  "trade",
  "trades",
  "motors",
  "motor",
  "cars",
  "car",
  "group",
  "dealer",
  "dealers",
  "dealership",
  "dealerships",
  "automotive",
  "vehicle",
  "vehicles",
  "truck",
  "trucks",
  "used",
  "preowned",
  "sales",
  "center",
  "centre",
  "inc",
  "llc",
  "co",
  "corp",
  "company",
  "the",
]);
const AUTOMOTIVE_DOMAIN_MODIFIERS = [
  "auto",
  "autos",
  "motors",
  "cars",
  "automotive",
] as const;

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
  const city = company.location.city.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const state = company.location.state.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const brandToken = buildCompanyTokens(company).slice(-1)[0];

  return dedupeStrings([
    brandToken && city ? `${brandToken} ${city}` : undefined,
    brandToken && city ? `${city} ${brandToken}` : undefined,
    brandToken && city ? `${brandToken} of ${city}` : undefined,
    brandToken && state ? `${brandToken} ${state}` : undefined,
    brandToken && state ? `${brandToken} dealership ${city}` : undefined,
  ]);
}

function tokenizeDomainWords(value: string | undefined) {
  if (!value) {
    return [];
  }

  return dedupeStrings(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

function buildLocationTokens(company: Company) {
  return dedupeStrings([
    ...tokenizeDomainWords(company.location.city),
    ...tokenizeDomainWords(company.location.state),
    ...tokenizeDomainWords(company.location.country),
  ]);
}

function buildDirectDomainCandidates(company: Company): WebsiteDiscoveryCandidate[] {
  const rawTokens = tokenizeDomainWords(company.name);
  const locationTokens = new Set(buildLocationTokens(company));
  const tokensWithoutLocation = rawTokens.filter((token) => !locationTokens.has(token));
  const nonNoiseTokens = tokensWithoutLocation.filter(
    (token) => !DOMAIN_NOISE_WORDS.has(token),
  );
  const coreTokens = nonNoiseTokens;
  const primaryToken = coreTokens[0];

  if (!primaryToken) {
    return [];
  }

  const cityToken = tokenizeDomainWords(company.location.city)[0];
  const stateToken = tokenizeDomainWords(company.location.state)[0];
  const baseCore = coreTokens.join("");
  const baseRaw = tokensWithoutLocation.join("");
  const country = company.location.country.toUpperCase();
  const tlds = country === "CA" ? ["com", "ca"] : ["com"];
  const candidates = new Map<
    string,
    {
      pattern: string;
      reason: string;
      isGenericGuess: boolean;
    }
  >();

  function addDomain(
    domainLabel: string | undefined,
    pattern: string,
    reason: string,
    isGenericGuess = false,
  ) {
    const trimmedLabel = domainLabel?.trim();

    if (!trimmedLabel || trimmedLabel.length < 4) {
      return;
    }

    for (const tld of tlds) {
      const url = normalizeWebsiteUrl(`${trimmedLabel}.${tld}`);

      if (!url || candidates.has(url)) {
        continue;
      }

      candidates.set(url, {
        pattern,
        reason,
        isGenericGuess,
      });
    }
  }

  addDomain(
    baseRaw,
    "raw_business_name",
    "Generated from the business name with location words removed.",
    baseRaw === primaryToken,
  );
  addDomain(
    baseCore,
    "core_business_name",
    "Generated from the core business-name tokens after stripping common domain noise.",
    baseCore === primaryToken,
  );

  if (primaryToken) {
    for (const modifier of AUTOMOTIVE_DOMAIN_MODIFIERS) {
      addDomain(
        `${primaryToken}${modifier}`,
        `primary_plus_${modifier}`,
        `Generated from the lead's primary business token with the "${modifier}" domain modifier.`,
      );
    }
  }

  if (cityToken) {
    addDomain(
      `${primaryToken}${cityToken}`,
      "primary_plus_city",
      "Generated from the lead's primary business token plus city.",
    );
    addDomain(
      `${cityToken}${primaryToken}`,
      "city_plus_primary",
      "Generated from the lead's city plus primary business token.",
    );
  }

  if (stateToken) {
    addDomain(
      `${primaryToken}${stateToken}`,
      "primary_plus_state",
      "Generated from the lead's primary business token plus state/province.",
    );
  }

  if (coreTokens.length >= 2) {
    addDomain(
      `${coreTokens[0]}${coreTokens[1]}`,
      "leading_core_pair",
      "Generated from the first two meaningful business-name tokens.",
    );
  }

  return [...candidates.entries()].slice(0, 10).map(([url, metadata]) => ({
    rawUrl: url,
    normalizedUrl: url,
    url,
    title: "",
    snippet: "",
    queryLabel: `direct domain inference (${metadata.pattern.replaceAll("_", " ")})`,
    acceptanceReason: metadata.reason,
    sourceType: "direct_domain_inference",
    sourceDetail: metadata.pattern,
    isGenericGuess: metadata.isGenericGuess,
  }));
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

function createSignalEvaluation(params: {
  label: string;
  detail: string;
  strength: CandidateSignalStrength;
  matched: boolean;
  scoreDelta?: number;
}) {
  return {
    label: params.label,
    detail: params.detail,
    strength: params.strength,
    matched: params.matched,
    scoreDelta: params.scoreDelta ?? 0,
  } satisfies CandidateSignalEvaluation;
}

function formatSignalEvaluation(evaluation: CandidateSignalEvaluation) {
  return `${evaluation.strength === "strong" ? "Strong" : "Supporting"} • ${evaluation.label}: ${evaluation.detail}`;
}

function summarizeSignalEvaluations(
  evaluations: CandidateSignalEvaluation[],
): CandidateSignalSummary {
  return {
    score: Math.max(
      0,
      evaluations.reduce((total, evaluation) => total + evaluation.scoreDelta, 0),
    ),
    signals: dedupeStrings(
      evaluations
        .filter((evaluation) => evaluation.matched)
        .map((evaluation) => evaluation.detail),
    ),
    signalHits: dedupeStrings(
      evaluations
        .filter((evaluation) => evaluation.matched)
        .map((evaluation) => formatSignalEvaluation(evaluation)),
    ),
    signalMisses: dedupeStrings(
      evaluations
        .filter((evaluation) => !evaluation.matched)
        .map((evaluation) => formatSignalEvaluation(evaluation)),
    ),
    strongSignalCount: evaluations.filter(
      (evaluation) => evaluation.matched && evaluation.strength === "strong",
    ).length,
  };
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

function buildCandidateDiagnosticDebugNotes(
  candidateDiagnostics: WebsiteDiscoveryCandidateDiagnostic[],
) {
  return dedupeStrings(
    candidateDiagnostics.map(
      (candidate) =>
        `${candidate.decision === "accepted" ? "Accepted" : candidate.decision === "needs_review" ? "Review candidate" : "Rejected"} [${
          candidate.sourceType
        }, verification ${candidate.verificationStage.replaceAll("_", " ")}] "${candidate.rawCandidate}"${
          candidate.normalizedCandidate ? ` -> "${candidate.normalizedCandidate}"` : ""
        } from ${candidate.queryLabel}: ${candidate.reason}${
          candidate.score > 0
            ? ` (score ${candidate.score}/100, strong signals ${candidate.strongSignalCount})`
            : ""
        }${
          candidate.canonicalRetrySucceeded
            ? `, canonical retry succeeded to ${candidate.canonicalVerifiedUrl ?? candidate.verificationResolvedUrl}`
            : candidate.canonicalVerifiedUrl &&
                candidate.canonicalVerifiedUrl !== candidate.verificationAttemptedUrl
              ? `, canonical URL ${candidate.canonicalVerifiedUrl}`
              : ""
        }${
          candidate.verificationFailureKind
            ? `, failure ${candidate.verificationFailureKind}: ${candidate.verificationFailureDetail ?? candidate.reason}`
            : ""
        }`,
    ),
  );
}

function dedupeCandidateDiagnostics(
  candidateDiagnostics: WebsiteDiscoveryCandidateDiagnostic[],
) {
  return candidateDiagnostics.filter(
    (candidate, index, collection) =>
      collection.findIndex(
        (current) =>
          current.sourceType === candidate.sourceType &&
          current.sourceDetail === candidate.sourceDetail &&
          current.rawCandidate === candidate.rawCandidate &&
          current.normalizedCandidate === candidate.normalizedCandidate &&
          current.queryLabel === candidate.queryLabel &&
          current.decision === candidate.decision &&
          current.reason === candidate.reason &&
          current.score === candidate.score &&
          current.strongSignalCount === candidate.strongSignalCount &&
          current.verificationStage === candidate.verificationStage &&
          current.verificationAttemptedUrl === candidate.verificationAttemptedUrl &&
          current.verificationResolvedUrl === candidate.verificationResolvedUrl &&
          current.canonicalVerifiedUrl === candidate.canonicalVerifiedUrl &&
          current.canonicalRetrySucceeded === candidate.canonicalRetrySucceeded &&
          current.verificationFailureKind === candidate.verificationFailureKind &&
          current.verificationFailureDetail === candidate.verificationFailureDetail,
      ) === index,
  );
}

function scoreSearchCandidate(
  company: Company,
  candidate: WebsiteDiscoveryCandidate,
) {
  const normalizedCandidateUrl = normalizeWebsiteUrl(candidate.url);

  if (!normalizedCandidateUrl) {
    return summarizeSignalEvaluations([
      createSignalEvaluation({
        label: "Candidate URL validity",
        detail: "Candidate URL was not a plausible public website.",
        strength: "supporting",
        matched: false,
      }),
    ]);
  }

  const companyTokens = buildCompanyTokens(company);
  const referenceTokens = extractReferenceTokens(
    company.presence.googleBusinessProfileUrl,
  );
  const url = new URL(normalizedCandidateUrl);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const previewText = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  const haystack = `${previewText} ${host}`.toLowerCase();
  const normalizedCompanyName = normalizeNameForComparison(company.name);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const normalizedCity = company.location.city.toLowerCase().trim();
  const normalizedState = company.location.state.toLowerCase().trim();
  const streetFragment = company.location.streetAddress
    ?.split(",")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const hostnameSignals = getHostnameSignals(host);
  const dealershipPhrases = buildDealershipPhrases(company);
  const phoneMatch =
    phoneDigits && candidate.snippet.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7));
  const hostTokenMatches = companyTokens.filter((token) => host.includes(token));
  const tokenMatches = companyTokens.filter((token) => haystack.includes(token));
  const dealershipPhraseMatches = dealershipPhrases.filter(
    (phrase) => haystack.includes(phrase) || hostnameSignals.includes(phrase),
  );
  const matchesBusinessName =
    normalizeNameForComparison(haystack).includes(normalizedCompanyName) ||
    tokenMatches.length >= Math.min(2, companyTokens.length);
  const cityMatch = Boolean(normalizedCity && haystack.includes(normalizedCity));
  const stateMatch = Boolean(normalizedState && haystack.includes(normalizedState));
  const addressMatch = Boolean(streetFragment && haystack.includes(streetFragment));
  const referenceMatch = referenceTokens.some((token) => haystack.includes(token));
  const officialClaim =
    /\bofficial site\b/i.test(candidate.title) || /\bofficial\b/i.test(candidate.snippet);
  const domainPlausibilityScore =
    hostTokenMatches.length >= Math.min(2, companyTokens.length)
      ? 16
      : hostTokenMatches.length > 0
        ? 10
        : candidate.sourceType === "direct_domain_inference" && !candidate.isGenericGuess
          ? 8
          : 0;
  const evaluations: CandidateSignalEvaluation[] = [
    createSignalEvaluation({
      label: "Business identity alignment",
      detail: matchesBusinessName
        ? "Candidate title, snippet, or domain align with the business name."
        : "Candidate title, snippet, and domain do not clearly align with the business name.",
      strength: "supporting",
      matched: matchesBusinessName,
      scoreDelta: matchesBusinessName ? 18 : 0,
    }),
    createSignalEvaluation({
      label: "Domain plausibility",
      detail:
        domainPlausibilityScore > 0
          ? "Domain structure plausibly matches the business naming pattern."
          : "Domain structure does not plausibly match the business naming pattern.",
      strength: "supporting",
      matched: domainPlausibilityScore > 0,
      scoreDelta: domainPlausibilityScore,
    }),
    createSignalEvaluation({
      label: "Preview location match",
      detail:
        cityMatch || stateMatch
          ? `Candidate preview references ${[
              cityMatch ? company.location.city : undefined,
              stateMatch ? company.location.state : undefined,
            ]
              .filter(Boolean)
              .join(" / ")}.`
          : "Candidate preview does not reference the imported city or state/province.",
      strength: "supporting",
      matched: cityMatch || stateMatch,
      scoreDelta: cityMatch && stateMatch ? 12 : cityMatch || stateMatch ? 8 : 0,
    }),
    createSignalEvaluation({
      label: "Preview phone match",
      detail: phoneMatch
        ? "Candidate preview matches the imported phone number."
        : "Candidate preview does not match the imported phone number.",
      strength: "strong",
      matched: Boolean(phoneMatch),
      scoreDelta: phoneMatch ? 16 : 0,
    }),
    createSignalEvaluation({
      label: "Preview address match",
      detail: addressMatch
        ? "Candidate preview references the imported street address."
        : "Candidate preview does not reference the imported street address.",
      strength: "strong",
      matched: addressMatch,
      scoreDelta: addressMatch ? 14 : 0,
    }),
    createSignalEvaluation({
      label: "Dealership or brand evidence",
      detail:
        dealershipPhraseMatches.length > 0
          ? "Candidate preview follows a dealership-style brand/location naming pattern."
          : "Candidate preview does not show a clear dealership-style or brand/location pattern.",
      strength: "supporting",
      matched: dealershipPhraseMatches.length > 0,
      scoreDelta: dealershipPhraseMatches.length > 0 ? 10 : 0,
    }),
    createSignalEvaluation({
      label: "Maps/profile hint alignment",
      detail: referenceMatch
        ? "Candidate aligns with Google Business Profile hint tokens."
        : "Candidate does not align with the available profile hint tokens.",
      strength: "supporting",
      matched: referenceMatch,
      scoreDelta: referenceMatch ? 6 : 0,
    }),
    createSignalEvaluation({
      label: "Official-site wording",
      detail: officialClaim
        ? "Candidate preview presents itself as the official site."
        : "Candidate preview does not explicitly present itself as the official site.",
      strength: "supporting",
      matched: officialClaim,
      scoreDelta: officialClaim ? 4 : 0,
    }),
  ];

  if (candidate.sourceType === "direct_domain_inference") {
    evaluations.push(
      createSignalEvaluation({
        label: "Direct-domain inference safety",
        detail: candidate.isGenericGuess
          ? "Inferred domain is generic and needs stronger confirmation before it can be trusted."
          : `Inferred domain was generated from the ${
              candidate.sourceDetail?.replaceAll("_", " ") ?? "business-name"
            } pattern.`,
        strength: "supporting",
        matched: !candidate.isGenericGuess,
        scoreDelta: candidate.isGenericGuess ? -12 : 6,
      }),
    );
  }

  if (host.endsWith(".com") || host.endsWith(".ca")) {
    evaluations.push(
      createSignalEvaluation({
        label: "Public TLD plausibility",
        detail: "Candidate uses a common public TLD.",
        strength: "supporting",
        matched: true,
        scoreDelta: 4,
      }),
    );
  }

  if (looksLikeDirectoryCandidate(candidate)) {
    evaluations.push(
      createSignalEvaluation({
        label: "Directory/listing penalty",
        detail: "Candidate looks like a directory, marketplace, or listing page.",
        strength: "supporting",
        matched: false,
        scoreDelta: -36,
      }),
    );
  }

  return summarizeSignalEvaluations(evaluations);
}

function getCanonicalHostFamily(candidateUrl: string) {
  try {
    return new URL(
      normalizeWebsiteUrl(candidateUrl) ?? candidateUrl,
    ).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function buildCanonicalRetryUrls(candidateUrl: string) {
  const normalizedCandidateUrl = normalizeWebsiteUrl(candidateUrl) ?? candidateUrl;

  try {
    const parsed = new URL(normalizedCandidateUrl);
    const bareHost = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const defaultPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    const suffix = `${defaultPath}${parsed.search}`;
    const alternateHost = parsed.hostname.toLowerCase().startsWith("www.")
      ? bareHost
      : `www.${bareHost}`;
    const alternateProtocol = parsed.protocol === "https:" ? "http:" : "https:";
    const variants = [
      `${parsed.protocol}//${parsed.host.toLowerCase()}${suffix}`,
      `${parsed.protocol}//${alternateHost}${suffix}`,
      `${alternateProtocol}//${parsed.host.toLowerCase()}${suffix}`,
      `${alternateProtocol}//${alternateHost}${suffix}`,
    ];

    return dedupeStrings(
      variants.map((variant) => normalizeWebsiteUrl(variant) ?? variant),
    );
  } catch {
    return [normalizedCandidateUrl];
  }
}

function classifyVerificationFailure(
  error: unknown,
): {
  kind: WebsiteDiscoveryVerificationFailureKind;
  detail: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const errorName =
    error instanceof Error && error.name ? error.name.toLowerCase() : "";
  const errorCause =
    error && typeof error === "object" && "cause" in error ? error.cause : undefined;
  const causeCode =
    errorCause && typeof errorCause === "object" && "code" in errorCause
      ? String(errorCause.code)
      : undefined;
  const detail = message.trim() || "Unknown verification error";

  if (
    errorName.includes("timeout") ||
    /timeout|timed out/i.test(detail) ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return {
      kind: "timeout",
      detail,
    };
  }

  if (
    causeCode === "ENOTFOUND" ||
    causeCode === "EAI_AGAIN" ||
    /enotfound|getaddrinfo|dns|name not resolved/i.test(detail)
  ) {
    return {
      kind: "dns_failure",
      detail,
    };
  }

  if (
    causeCode?.startsWith("ERR_TLS_") ||
    [
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "ERR_SSL_WRONG_VERSION_NUMBER",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    ].includes(causeCode ?? "") ||
    /tls|ssl|certificate/i.test(detail)
  ) {
    return {
      kind: "tls_failure",
      detail,
    };
  }

  const httpStatusMatch = detail.match(/^HTTP\s+(\d{3})$/i);

  if (httpStatusMatch) {
    const statusCode = Number(httpStatusMatch[1]);

    if (statusCode === 401 || statusCode === 403) {
      return {
        kind: "blocked_forbidden",
        detail,
      };
    }

    return {
      kind: "http_error",
      detail,
    };
  }

  if (/redirect/i.test(detail) && /loop|exceeded|count/i.test(detail)) {
    return {
      kind: "redirect_loop",
      detail,
    };
  }

  return {
    kind: "network_error",
    detail,
  };
}

function buildVerificationFailureError(params: {
  attemptedUrl: string;
  attemptedUrls: string[];
  failureKind: WebsiteDiscoveryVerificationFailureKind;
  failureDetail: string;
}) {
  return Object.assign(new Error(params.failureDetail), {
    attemptedUrl: params.attemptedUrl,
    attemptedUrls: params.attemptedUrls,
    verificationFailureKind: params.failureKind,
    verificationFailureDetail: params.failureDetail,
  });
}

function canAdoptResolvedCanonicalUrl(
  attemptedUrl: string,
  resolvedUrl: string,
) {
  const attemptedFamily = getCanonicalHostFamily(attemptedUrl);
  const resolvedFamily = getCanonicalHostFamily(resolvedUrl);

  return Boolean(
    attemptedFamily &&
      resolvedFamily &&
      attemptedFamily === resolvedFamily,
  );
}

async function fetchPageVariant(candidateUrl: string) {
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

  return {
    html: await response.text(),
    resolvedUrl: normalizeWebsiteUrl(response.url) ?? normalizeWebsiteUrl(candidateUrl) ?? candidateUrl,
  };
}

async function fetchCandidatePage(candidateUrl: string): Promise<CandidatePageFetchResult> {
  const normalizedCandidateUrl = normalizeWebsiteUrl(candidateUrl) ?? candidateUrl;
  const attemptedUrls = buildCanonicalRetryUrls(normalizedCandidateUrl);
  let lastFailure:
    | {
        kind: WebsiteDiscoveryVerificationFailureKind;
        detail: string;
      }
    | undefined;

  for (const attemptUrl of attemptedUrls) {
    try {
      const page = await fetchPageVariant(attemptUrl);
      const canonicalUrl = canAdoptResolvedCanonicalUrl(
        normalizedCandidateUrl,
        page.resolvedUrl,
      )
        ? page.resolvedUrl
        : normalizeWebsiteUrl(attemptUrl) ?? attemptUrl;

      return {
        html: page.html,
        attemptedUrl: normalizedCandidateUrl,
        attemptedUrls,
        resolvedUrl: page.resolvedUrl,
        canonicalUrl,
        resolvedUrlBecameCanonical: canonicalUrl !== normalizedCandidateUrl,
        canonicalRetrySucceeded:
          attemptUrl !== normalizedCandidateUrl &&
          canAdoptResolvedCanonicalUrl(normalizedCandidateUrl, canonicalUrl),
      };
    } catch (error) {
      lastFailure = classifyVerificationFailure(error);
    }
  }

  throw buildVerificationFailureError({
    attemptedUrl: normalizedCandidateUrl,
    attemptedUrls,
    failureKind: lastFailure?.kind ?? "network_error",
    failureDetail:
      lastFailure?.detail ??
      "Verification crawl failed without a classified error.",
  });
}

function verifyCandidateHomepage(
  company: Company,
  candidate: WebsiteDiscoveryCandidate,
  page: CandidatePageFetchResult,
): CandidateVerificationResult {
  const html = page.html;
  const text = stripHtml(html).toLowerCase();
  const companyTokens = buildCompanyTokens(company);
  const normalizedCompanyName = normalizeNameForComparison(company.name);
  const phoneDigits = normalizePhone(company.presence.primaryPhone);
  const normalizedCity = company.location.city.toLowerCase().trim();
  const normalizedState = company.location.state.toLowerCase().trim();
  const street = company.location.streetAddress?.toLowerCase();
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const supportingPageCandidates = extractLikelyInternalPageCandidates(
    html,
    page.canonicalUrl,
    10,
  );
  const tokenMatches = companyTokens.filter((token) => text.includes(token));
  const staffPageUrls = getSupportingPageUrlsByKind(supportingPageCandidates, "staff");
  const contactPageUrls = getSupportingPageUrlsByKind(
    supportingPageCandidates,
    "contact",
  );
  const cityMatch = Boolean(normalizedCity && text.includes(normalizedCity));
  const stateMatch = Boolean(normalizedState && text.includes(normalizedState));
  const addressMatch = Boolean(street && text.includes(street.split(",")[0]?.toLowerCase() ?? ""));
  const phoneMatch = Boolean(
    phoneDigits && text.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7)),
  );
  const businessNameMatch =
    normalizeNameForComparison(`${title} ${text}`).includes(normalizedCompanyName) ||
    tokenMatches.length >= Math.min(2, companyTokens.length);
  const brandEvidenceMatch =
    buildDealershipPhrases(company).some((phrase) => text.includes(phrase)) ||
    /\b(inventory|used cars|dealership|dealer|auto|motors|cars)\b/i.test(
      `${title} ${text}`,
    );
  const evaluations: CandidateSignalEvaluation[] = [
    createSignalEvaluation({
      label: "Homepage business-name match",
      detail: businessNameMatch
        ? "Homepage content clearly matches the business name."
        : "Homepage content does not clearly match the business name.",
      strength: "strong",
      matched: businessNameMatch,
      scoreDelta: businessNameMatch ? 26 : 0,
    }),
    createSignalEvaluation({
      label: "Homepage location match",
      detail:
        cityMatch || stateMatch
          ? `Homepage references ${[
              cityMatch ? company.location.city : undefined,
              stateMatch ? company.location.state : undefined,
            ]
              .filter(Boolean)
              .join(" / ")}.`
          : "Homepage does not reference the imported city or state/province.",
      strength: "strong",
      matched: cityMatch || stateMatch,
      scoreDelta: cityMatch && stateMatch ? 14 : cityMatch || stateMatch ? 10 : 0,
    }),
    createSignalEvaluation({
      label: "Homepage phone match",
      detail: phoneMatch
        ? "Homepage references the imported phone number."
        : "Homepage does not reference the imported phone number.",
      strength: "strong",
      matched: phoneMatch,
      scoreDelta: phoneMatch ? 22 : 0,
    }),
    createSignalEvaluation({
      label: "Homepage address match",
      detail: addressMatch
        ? "Homepage references the imported street address."
        : "Homepage does not reference the imported street address.",
      strength: "strong",
      matched: addressMatch,
      scoreDelta: addressMatch ? 18 : 0,
    }),
    createSignalEvaluation({
      label: "Dealership or brand evidence",
      detail: brandEvidenceMatch
        ? "Homepage shows dealership-specific or brand/location evidence."
        : "Homepage does not show clear dealership-specific or brand/location evidence.",
      strength: "supporting",
      matched: brandEvidenceMatch,
      scoreDelta: brandEvidenceMatch ? 10 : 0,
    }),
    createSignalEvaluation({
      label: "Public staff/team page",
      detail:
        staffPageUrls.length > 0
          ? "Homepage links to a public staff or team page."
          : "Homepage does not link to a public staff or team page.",
      strength: "supporting",
      matched: staffPageUrls.length > 0,
      scoreDelta: staffPageUrls.length > 0 ? 8 : 0,
    }),
    createSignalEvaluation({
      label: "Public contact page",
      detail:
        contactPageUrls.length > 0
          ? "Homepage links to a public contact page."
          : "Homepage does not link to a public contact page.",
      strength: "supporting",
      matched: contactPageUrls.length > 0,
      scoreDelta: contactPageUrls.length > 0 ? 6 : 0,
    }),
  ];
  const signalSummary = summarizeSignalEvaluations(evaluations);

  return {
    ...signalSummary,
    supportingPageCandidates,
    extractedEvidence: dedupeStrings([
      businessNameMatch ? "Homepage content clearly matched the business name." : undefined,
      cityMatch || stateMatch
        ? `Homepage referenced ${[
            cityMatch ? company.location.city : undefined,
            stateMatch ? company.location.state : undefined,
          ]
            .filter(Boolean)
            .join(" / ")}.`
        : undefined,
      phoneMatch ? "Homepage referenced the imported phone number." : undefined,
      addressMatch ? "Homepage referenced the imported street address." : undefined,
      brandEvidenceMatch
        ? "Homepage showed dealership-style or brand/location evidence."
        : undefined,
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
    verificationStage: "homepage",
    verificationAttemptedUrl: page.attemptedUrl,
    verificationAttemptUrls: page.attemptedUrls,
    verificationResolvedUrl: page.resolvedUrl,
    canonicalVerifiedUrl: page.canonicalUrl,
    resolvedUrlBecameCanonical: page.resolvedUrlBecameCanonical,
    canonicalRetrySucceeded: page.canonicalRetrySucceeded,
    verificationEvidence: dedupeStrings([
      "Verification crawl checked the homepage.",
      `Verification attempted ${page.attemptedUrl}.`,
      page.canonicalRetrySucceeded
        ? `Canonical retry succeeded and verified ${page.canonicalUrl}.`
        : undefined,
      page.resolvedUrlBecameCanonical
        ? `Final resolved URL ${page.resolvedUrl} became the canonical verified URL.`
        : undefined,
      businessNameMatch ? "Homepage matched the business name." : undefined,
      phoneMatch ? "Homepage matched the imported phone number." : undefined,
      addressMatch ? "Homepage matched the imported street address." : undefined,
      cityMatch || stateMatch
        ? "Homepage matched the imported location."
        : undefined,
      brandEvidenceMatch
        ? "Homepage showed dealership or brand evidence."
        : undefined,
    ]),
    verificationPageUrls: [page.canonicalUrl],
  };
}

function getSupportingPageVerificationLabel(
  kind: Exclude<SupportingPageKind, "homepage">,
) {
  switch (kind) {
    case "contact":
      return "Contact page";
    case "about":
      return "About page";
    case "staff":
      return "Staff page";
  }
}

function shouldRunLightweightVerificationCrawl(candidate: ScoredSearchCandidate) {
  return (
    candidate.score >= LIGHTWEIGHT_VERIFICATION_MIN_SCORE &&
    candidate.score <= LIGHTWEIGHT_VERIFICATION_MAX_SCORE
  );
}

function selectSupportingPagesForVerification(
  supportingPageCandidates: SupportingPageCandidate[],
) {
  const preferenceOrder: Record<SupportingPageCandidate["kind"], number> = {
    contact: 0,
    about: 1,
    staff: 2,
  };

  return [...supportingPageCandidates]
    .sort((left, right) => {
      const preferenceDelta =
        preferenceOrder[left.kind] - preferenceOrder[right.kind];

      if (preferenceDelta !== 0) {
        return preferenceDelta;
      }

      return right.score - left.score;
    })
    .slice(0, LIGHTWEIGHT_VERIFICATION_PAGE_LIMIT);
}

function verifyCandidateSupportingPage(params: {
  company: Company;
  page: SupportingPageCandidate;
  fetchedPage: CandidatePageFetchResult;
}): CandidateVerificationResult {
  const text = stripHtml(params.fetchedPage.html).toLowerCase();
  const title = stripHtml(
    params.fetchedPage.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  const companyTokens = buildCompanyTokens(params.company);
  const normalizedCompanyName = normalizeNameForComparison(params.company.name);
  const phoneDigits = normalizePhone(params.company.presence.primaryPhone);
  const normalizedCity = params.company.location.city.toLowerCase().trim();
  const normalizedState = params.company.location.state.toLowerCase().trim();
  const streetFragment = params.company.location.streetAddress
    ?.split(",")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const cityMatch = Boolean(normalizedCity && text.includes(normalizedCity));
  const stateMatch = Boolean(normalizedState && text.includes(normalizedState));
  const addressMatch = Boolean(streetFragment && text.includes(streetFragment));
  const phoneMatch = Boolean(
    phoneDigits && text.replace(/[^\d]/g, "").includes(phoneDigits.slice(-7)),
  );
  const businessNameMatch =
    normalizeNameForComparison(`${title} ${text}`).includes(normalizedCompanyName) ||
    companyTokens.filter((token) => text.includes(token)).length >=
      Math.min(2, companyTokens.length);
  const brandEvidenceMatch =
    buildDealershipPhrases(params.company).some((phrase) => text.includes(phrase)) ||
    /\b(inventory|used cars|dealership|dealer|auto|motors|cars|financing|service)\b/i.test(
      `${title} ${text}`,
    );
  const publicContactCluesMatch =
    /\b(contact|call|phone|email|hours|directions|visit|sales|service)\b/i.test(
      `${title} ${text}`,
    ) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const pageLabel = getSupportingPageVerificationLabel(params.page.kind);
  const evaluations: CandidateSignalEvaluation[] = [
    createSignalEvaluation({
      label: `${pageLabel} business-name match`,
      detail: businessNameMatch
        ? `${pageLabel} content matched the business name.`
        : `${pageLabel} content did not clearly match the business name.`,
      strength: "strong",
      matched: businessNameMatch,
      scoreDelta: businessNameMatch ? 18 : 0,
    }),
    createSignalEvaluation({
      label: `${pageLabel} phone match`,
      detail: phoneMatch
        ? `${pageLabel} referenced the imported phone number.`
        : `${pageLabel} did not reference the imported phone number.`,
      strength: "strong",
      matched: phoneMatch,
      scoreDelta: phoneMatch ? 16 : 0,
    }),
    createSignalEvaluation({
      label: `${pageLabel} address match`,
      detail: addressMatch
        ? `${pageLabel} referenced the imported street address.`
        : `${pageLabel} did not reference the imported street address.`,
      strength: "strong",
      matched: addressMatch,
      scoreDelta: addressMatch ? 14 : 0,
    }),
    createSignalEvaluation({
      label: `${pageLabel} location match`,
      detail:
        cityMatch || stateMatch
          ? `${pageLabel} referenced ${[
              cityMatch ? params.company.location.city : undefined,
              stateMatch ? params.company.location.state : undefined,
            ]
              .filter(Boolean)
              .join(" / ")}.`
          : `${pageLabel} did not reference the imported city or state/province.`,
      strength: "supporting",
      matched: cityMatch || stateMatch,
      scoreDelta: cityMatch && stateMatch ? 10 : cityMatch || stateMatch ? 8 : 0,
    }),
    createSignalEvaluation({
      label: `${pageLabel} dealership or brand evidence`,
      detail: brandEvidenceMatch
        ? `${pageLabel} showed dealership-style or brand/location evidence.`
        : `${pageLabel} did not show clear dealership-style or brand/location evidence.`,
      strength: "supporting",
      matched: brandEvidenceMatch,
      scoreDelta: brandEvidenceMatch ? 8 : 0,
    }),
    createSignalEvaluation({
      label: `${pageLabel} public contact clues`,
      detail: publicContactCluesMatch
        ? `${pageLabel} exposed public contact clues.`
        : `${pageLabel} did not expose public contact clues.`,
      strength: "supporting",
      matched: publicContactCluesMatch,
      scoreDelta: publicContactCluesMatch ? 6 : 0,
    }),
  ];
  const signalSummary = summarizeSignalEvaluations(evaluations);

  return {
    ...signalSummary,
    supportingPageCandidates: [],
    extractedEvidence: dedupeStrings([
      `${pageLabel} checked during lightweight verification crawl.`,
      businessNameMatch ? `${pageLabel} matched the business name.` : undefined,
      phoneMatch ? `${pageLabel} matched the imported phone number.` : undefined,
      addressMatch ? `${pageLabel} matched the imported street address.` : undefined,
      cityMatch || stateMatch ? `${pageLabel} matched the imported location.` : undefined,
      brandEvidenceMatch
        ? `${pageLabel} showed dealership or brand evidence.`
        : undefined,
      publicContactCluesMatch
        ? `${pageLabel} exposed public contact clues.`
        : undefined,
    ]),
    verificationStage: "lightweight_crawl",
    verificationAttemptedUrl: params.fetchedPage.attemptedUrl,
    verificationAttemptUrls: params.fetchedPage.attemptedUrls,
    verificationResolvedUrl: params.fetchedPage.resolvedUrl,
    canonicalVerifiedUrl: params.fetchedPage.canonicalUrl,
    resolvedUrlBecameCanonical: params.fetchedPage.resolvedUrlBecameCanonical,
    canonicalRetrySucceeded: params.fetchedPage.canonicalRetrySucceeded,
    verificationPageUrls: [params.fetchedPage.canonicalUrl],
    verificationEvidence: dedupeStrings([
      `${pageLabel} was checked during lightweight verification crawl.`,
      `Verification attempted ${params.fetchedPage.attemptedUrl}.`,
      params.fetchedPage.canonicalRetrySucceeded
        ? `${pageLabel} only worked after canonical retry and resolved to ${params.fetchedPage.canonicalUrl}.`
        : undefined,
      params.fetchedPage.resolvedUrlBecameCanonical
        ? `${pageLabel} resolved to canonical URL ${params.fetchedPage.canonicalUrl}.`
        : undefined,
      businessNameMatch ? `${pageLabel} matched the business name.` : undefined,
      phoneMatch ? `${pageLabel} matched the imported phone number.` : undefined,
      addressMatch ? `${pageLabel} matched the imported street address.` : undefined,
      cityMatch || stateMatch ? `${pageLabel} matched the imported location.` : undefined,
      publicContactCluesMatch
        ? `${pageLabel} exposed public contact clues.`
        : undefined,
    ]),
  };
}

async function runCandidateVerificationCrawl(
  company: Company,
  candidate: ScoredSearchCandidate,
): Promise<ScoredSearchCandidate> {
  const verificationAttemptNotes = [
    `Verification crawl queued for ${candidate.url}.`,
  ];

  try {
    const homepagePage = await fetchCandidatePage(candidate.url);
    const homepageVerification = verifyCandidateHomepage(
      company,
      candidate,
      homepagePage,
    );
    let verifiedCandidate = {
      ...candidate,
      normalizedUrl: homepageVerification.canonicalVerifiedUrl ?? candidate.normalizedUrl,
      url: homepageVerification.canonicalVerifiedUrl ?? candidate.url,
      score: candidate.score + homepageVerification.score,
      signals: dedupeStrings([...candidate.signals, ...homepageVerification.signals]),
      signalHits: dedupeStrings([
        ...candidate.signalHits,
        ...homepageVerification.signalHits,
      ]),
      signalMisses: dedupeStrings([
        ...candidate.signalMisses,
        ...homepageVerification.signalMisses,
      ]),
      strongSignalCount:
        candidate.strongSignalCount + homepageVerification.strongSignalCount,
      supportingPageCandidates: homepageVerification.supportingPageCandidates,
      extractedEvidence: dedupeStrings([
        ...candidate.extractedEvidence,
        ...homepageVerification.extractedEvidence,
      ]),
      verificationStage: homepageVerification.verificationStage,
      verificationPageUrls: dedupeStrings([
        ...candidate.verificationPageUrls,
        ...homepageVerification.verificationPageUrls,
      ]),
      verificationEvidence: dedupeStrings([
        ...candidate.verificationEvidence,
        ...verificationAttemptNotes,
        ...homepageVerification.verificationEvidence,
      ]),
      verificationAttemptedUrl: homepageVerification.verificationAttemptedUrl,
      verificationAttemptUrls: dedupeStrings([
        ...candidate.verificationAttemptUrls,
        ...homepageVerification.verificationAttemptUrls,
      ]),
      verificationResolvedUrl: homepageVerification.verificationResolvedUrl,
      canonicalVerifiedUrl: homepageVerification.canonicalVerifiedUrl,
      resolvedUrlBecameCanonical: homepageVerification.resolvedUrlBecameCanonical,
      canonicalRetrySucceeded: homepageVerification.canonicalRetrySucceeded,
      verificationFailureKind: homepageVerification.verificationFailureKind,
      verificationFailureDetail: homepageVerification.verificationFailureDetail,
    } satisfies ScoredSearchCandidate;

    if (!shouldRunLightweightVerificationCrawl(candidate)) {
      return verifiedCandidate;
    }

    const pagesToVerify = selectSupportingPagesForVerification(
      homepageVerification.supportingPageCandidates,
    );

    if (pagesToVerify.length === 0) {
      return {
        ...verifiedCandidate,
        verificationEvidence: dedupeStrings([
          ...verifiedCandidate.verificationEvidence,
          "Lightweight verification crawl found no obvious contact, about, or staff pages to check after the homepage.",
        ]),
      };
    }

    const supportingPageResults = await Promise.all(
      pagesToVerify.map(async (page) => {
        try {
          const fetchedPage = await fetchCandidatePage(page.url);

          return verifyCandidateSupportingPage({
            company,
            page,
            fetchedPage,
          });
        } catch (error) {
          const verificationFailureKind =
            error && typeof error === "object" && "verificationFailureKind" in error
              ? (error.verificationFailureKind as WebsiteDiscoveryVerificationFailureKind)
              : classifyVerificationFailure(error).kind;
          const verificationFailureDetail =
            error && typeof error === "object" && "verificationFailureDetail" in error
              ? String(error.verificationFailureDetail)
              : classifyVerificationFailure(error).detail;
          const attemptedUrl =
            error && typeof error === "object" && "attemptedUrl" in error
              ? String(error.attemptedUrl)
              : page.url;
          const attemptedUrls =
            error && typeof error === "object" && "attemptedUrls" in error
              ? ((error.attemptedUrls as string[]) ?? [])
              : [page.url];

          return {
            score: 0,
            signals: [],
            signalHits: [],
            signalMisses: [
              `${getSupportingPageVerificationLabel(page.kind)} could not be fetched during lightweight verification crawl${
                verificationFailureDetail ? ` (${verificationFailureDetail})` : ""
              }.`,
            ],
            strongSignalCount: 0,
            supportingPageCandidates: [],
            extractedEvidence: [
              `${getSupportingPageVerificationLabel(page.kind)} could not be fetched during lightweight verification crawl.`,
            ],
            verificationStage: "lightweight_crawl",
            verificationAttemptedUrl: attemptedUrl,
            verificationAttemptUrls: attemptedUrls,
            verificationResolvedUrl: undefined,
            canonicalVerifiedUrl: undefined,
            resolvedUrlBecameCanonical: false,
            canonicalRetrySucceeded: false,
            verificationFailureKind,
            verificationFailureDetail,
            verificationPageUrls: [],
            verificationEvidence: [
              `${getSupportingPageVerificationLabel(page.kind)} was selected for lightweight verification crawl but could not be fetched.`,
            ],
          } satisfies CandidateVerificationResult;
        }
      }),
    );

    const combinedSupportingScore = supportingPageResults.reduce(
      (total, result) => total + result.score,
      0,
    );
    const combinedSupportingStrongSignals = supportingPageResults.reduce(
      (total, result) => total + result.strongSignalCount,
      0,
    );
    const combinedSupportingSignals = dedupeStrings(
      supportingPageResults.flatMap((result) => result.signals),
    );
    const combinedSupportingHits = dedupeStrings(
      supportingPageResults.flatMap((result) => result.signalHits),
    );
    const combinedSupportingMisses = dedupeStrings(
      supportingPageResults.flatMap((result) => result.signalMisses),
    );
    const combinedSupportingEvidence = dedupeStrings(
      supportingPageResults.flatMap((result) => result.extractedEvidence),
    );
    const combinedVerificationEvidence = dedupeStrings(
      supportingPageResults.flatMap((result) => result.verificationEvidence),
    );
    const successfulSupportingPageCount = supportingPageResults.filter((result) =>
      result.extractedEvidence.some((value) =>
        /checked during lightweight verification crawl/i.test(value),
      ),
    ).length;
    const verificationPenaltyMiss =
      successfulSupportingPageCount > 0 && combinedSupportingHits.length === 0
        ? "Lightweight verification crawl did not find corroborating business, location, address, phone, or contact evidence on the fetched follow-up pages."
        : undefined;

    verifiedCandidate = {
      ...verifiedCandidate,
      score: Math.max(
        0,
        verifiedCandidate.score +
        combinedSupportingScore -
        (verificationPenaltyMiss ? 24 : 0),
      ),
      signals: dedupeStrings([
        ...verifiedCandidate.signals,
        ...combinedSupportingSignals,
      ]),
      signalHits: dedupeStrings([
        ...verifiedCandidate.signalHits,
        ...combinedSupportingHits,
      ]),
      signalMisses: dedupeStrings([
        ...verifiedCandidate.signalMisses,
        ...combinedSupportingMisses,
        verificationPenaltyMiss,
      ]),
      strongSignalCount:
        verifiedCandidate.strongSignalCount + combinedSupportingStrongSignals,
      extractedEvidence: dedupeStrings([
        ...verifiedCandidate.extractedEvidence,
        ...combinedSupportingEvidence,
        verificationPenaltyMiss,
      ]),
      verificationStage: "lightweight_crawl",
      verificationPageUrls: dedupeStrings([
        ...verifiedCandidate.verificationPageUrls,
        ...supportingPageResults.flatMap((result) => result.verificationPageUrls),
      ]),
      verificationEvidence: dedupeStrings([
        ...verifiedCandidate.verificationEvidence,
        `Lightweight verification crawl checked ${pagesToVerify.length} supporting page${
          pagesToVerify.length === 1 ? "" : "s"
        } after the homepage.`,
        ...combinedVerificationEvidence,
        verificationPenaltyMiss,
      ]),
      verificationAttemptUrls: dedupeStrings([
        ...verifiedCandidate.verificationAttemptUrls,
        ...supportingPageResults.flatMap((result) => result.verificationAttemptUrls),
      ]),
    };

    return verifiedCandidate;
  } catch (error) {
    const verificationFailureKind =
      error && typeof error === "object" && "verificationFailureKind" in error
        ? (error.verificationFailureKind as WebsiteDiscoveryVerificationFailureKind)
        : classifyVerificationFailure(error).kind;
    const verificationFailureDetail =
      error && typeof error === "object" && "verificationFailureDetail" in error
        ? String(error.verificationFailureDetail)
        : classifyVerificationFailure(error).detail;
    const attemptedUrl =
      error && typeof error === "object" && "attemptedUrl" in error
        ? String(error.attemptedUrl)
        : candidate.url;
    const attemptedUrls =
      error && typeof error === "object" && "attemptedUrls" in error
        ? ((error.attemptedUrls as string[]) ?? [])
        : [candidate.url];

    return {
      ...candidate,
      verificationStage: "homepage",
      verificationAttemptedUrl: attemptedUrl,
      verificationAttemptUrls: attemptedUrls,
      verificationResolvedUrl: undefined,
      canonicalVerifiedUrl: undefined,
      resolvedUrlBecameCanonical: false,
      canonicalRetrySucceeded: false,
      verificationFailureKind,
      verificationFailureDetail,
      verificationPageUrls: dedupeStrings([
        ...candidate.verificationPageUrls,
      ]),
      verificationEvidence: dedupeStrings([
        ...candidate.verificationEvidence,
        ...verificationAttemptNotes,
        `Verification crawl could not fetch the homepage (${verificationFailureKind}: ${verificationFailureDetail}).`,
      ]),
      signalMisses: dedupeStrings([
        ...candidate.signalMisses,
        `Homepage could not be fetched during verification crawl (${verificationFailureKind}: ${verificationFailureDetail}).`,
      ]),
      extractedEvidence: dedupeStrings([
        ...candidate.extractedEvidence,
        "Verification crawl could not fetch the homepage.",
      ]),
    };
  }
}

function getRequiredStrongSignals(candidate: ScoredSearchCandidate) {
  if (candidate.sourceType !== "direct_domain_inference") {
    return candidate.score >= CONDITIONAL_AUTO_CONFIRM_MIN_SCORE &&
      candidate.score < AUTO_CONFIRM_MIN_SCORE
      ? 2
      : 0;
  }

  return candidate.isGenericGuess
    ? GENERIC_DIRECT_DOMAIN_REQUIRED_STRONG_SIGNALS
    : DIRECT_DOMAIN_REQUIRED_STRONG_SIGNALS;
}

function determineCandidateDecision(candidate: ScoredSearchCandidate) {
  const requiredStrongSignals = getRequiredStrongSignals(candidate);
  const verificationSummary =
    candidate.verificationStage === "lightweight_crawl"
      ? "after lightweight verification crawl"
      : candidate.verificationStage === "homepage"
        ? "after homepage verification"
        : undefined;

  if (candidate.score < DISCARD_CANDIDATE_MIN_SCORE) {
    return {
      decision: "rejected" as const,
      reason: verificationSummary
        ? `Rejected ${verificationSummary} because the candidate only reached ${candidate.score}/100, which is below the discard threshold.`
        : `Rejected below the discard threshold at ${candidate.score}/100.`,
    };
  }

  if (candidate.score < CONDITIONAL_AUTO_CONFIRM_MIN_SCORE) {
    return {
      decision: "needs_review" as const,
      reason: verificationSummary
        ? `Held for review ${verificationSummary} at ${candidate.score}/100 because the verification evidence improved confidence but still did not clear the auto-confirm band.`
        : `Held for review at ${candidate.score}/100 because it looks plausible but is still below the crawl/auto-confirm band.`,
    };
  }

  if (requiredStrongSignals > 0 && candidate.strongSignalCount < requiredStrongSignals) {
    return {
      decision: "needs_review" as const,
      reason:
        candidate.sourceType === "direct_domain_inference"
          ? `Held for review${
              verificationSummary ? ` ${verificationSummary}` : ""
            } because inferred domains require ${requiredStrongSignals} strong confirmation signals and this candidate only has ${candidate.strongSignalCount}.`
          : `Held for review${
              verificationSummary ? ` ${verificationSummary}` : ""
            } because candidates in the ${CONDITIONAL_AUTO_CONFIRM_MIN_SCORE}-${AUTO_CONFIRM_MIN_SCORE - 1} score band require at least ${requiredStrongSignals} strong confirmation signals and this candidate only has ${candidate.strongSignalCount}.`,
    };
  }

  return {
    decision: "accepted" as const,
    reason:
      candidate.sourceType === "direct_domain_inference"
        ? `Accepted${
            verificationSummary ? ` ${verificationSummary}` : ""
          } at ${candidate.score}/100 because the inferred domain cleared the safety gate with ${candidate.strongSignalCount} strong confirmation signals.`
        : `Accepted${
            verificationSummary ? ` ${verificationSummary}` : ""
          } at ${candidate.score}/100 with ${candidate.strongSignalCount} strong confirmation signals.`,
  };
}

function buildScoredCandidateDiagnostic(candidate: ScoredSearchCandidate) {
  const decision = determineCandidateDecision(candidate);

  return {
    sourceType: candidate.sourceType,
    sourceDetail: candidate.sourceDetail,
    isGenericGuess: candidate.isGenericGuess,
    rawCandidate: candidate.rawUrl,
    normalizedCandidate: candidate.url,
    queryLabel: candidate.queryLabel,
    title: candidate.title || undefined,
    score: candidate.score,
    strongSignalCount: candidate.strongSignalCount,
    verificationStage: candidate.verificationStage,
    verificationAttemptedUrl: candidate.verificationAttemptedUrl,
    verificationAttemptUrls: candidate.verificationAttemptUrls,
    verificationResolvedUrl: candidate.verificationResolvedUrl,
    canonicalVerifiedUrl: candidate.canonicalVerifiedUrl,
    resolvedUrlBecameCanonical: candidate.resolvedUrlBecameCanonical,
    canonicalRetrySucceeded: candidate.canonicalRetrySucceeded,
    verificationFailureKind: candidate.verificationFailureKind,
    verificationFailureDetail: candidate.verificationFailureDetail,
    verificationPageUrls: candidate.verificationPageUrls,
    verificationEvidence: candidate.verificationEvidence,
    signalHits: candidate.signalHits,
    signalMisses: candidate.signalMisses,
    decision: decision.decision,
    reason: decision.reason,
  } satisfies WebsiteDiscoveryCandidateDiagnostic;
}

function getCandidateSelectionPriority(candidate: ScoredSearchCandidate) {
  if (candidate.sourceType === "search_result") {
    return 0;
  }

  switch (candidate.sourceDetail) {
    case "raw_business_name":
      return 1;
    case "leading_core_pair":
      return 2;
    case "primary_plus_city":
    case "city_plus_primary":
    case "primary_plus_state":
      return 3;
    case "core_business_name":
      return candidate.isGenericGuess ? 6 : 4;
    default:
      return candidate.sourceDetail?.startsWith("primary_plus_") ? 5 : 7;
  }
}

function compareRankedCandidates(
  left: ScoredSearchCandidate,
  right: ScoredSearchCandidate,
) {
  const scoreDelta = right.score - left.score;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const priorityDelta =
    getCandidateSelectionPriority(left) - getCandidateSelectionPriority(right);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (left.sourceType !== right.sourceType) {
    return left.sourceType === "search_result" ? -1 : 1;
  }

  return left.url.localeCompare(right.url);
}

function selectCandidatesForReview(candidates: ScoredSearchCandidate[]) {
  const rankedCandidates = [...candidates].sort(compareRankedCandidates);
  const selectedCandidates = new Map<string, ScoredSearchCandidate>();

  function addCandidate(candidate: ScoredSearchCandidate | undefined) {
    if (!candidate || selectedCandidates.has(candidate.url) || selectedCandidates.size >= 8) {
      return;
    }

    selectedCandidates.set(candidate.url, candidate);
  }

  rankedCandidates.slice(0, 6).forEach((candidate) => addCandidate(candidate));
  addCandidate(
    rankedCandidates.find((candidate) => candidate.sourceType === "search_result"),
  );
  addCandidate(
    rankedCandidates.find(
      (candidate) =>
        candidate.sourceType === "direct_domain_inference" &&
        candidate.isGenericGuess &&
        candidate.score >= DISCARD_CANDIDATE_MIN_SCORE,
    ),
  );

  return [...selectedCandidates.values()].sort(compareRankedCandidates);
}

function selectCandidatesForVerification(candidates: ScoredSearchCandidate[]) {
  const rankedCandidates = [...candidates].sort(compareRankedCandidates);
  const selectedCandidates = new Map<string, ScoredSearchCandidate>();

  function addCandidate(candidate: ScoredSearchCandidate | undefined) {
    if (!candidate || selectedCandidates.has(candidate.url) || selectedCandidates.size >= 5) {
      return;
    }

    selectedCandidates.set(candidate.url, candidate);
  }

  rankedCandidates.slice(0, 3).forEach((candidate) => addCandidate(candidate));
  addCandidate(
    rankedCandidates.find((candidate) => candidate.sourceType === "search_result"),
  );
  addCandidate(
    rankedCandidates.find(
      (candidate) =>
        candidate.sourceType === "direct_domain_inference" &&
        !candidate.isGenericGuess,
    ),
  );
  addCandidate(
    rankedCandidates.find(
      (candidate) =>
        candidate.sourceType === "direct_domain_inference" &&
        candidate.isGenericGuess &&
        candidate.score >= DISCARD_CANDIDATE_MIN_SCORE,
    ),
  );

  return [...selectedCandidates.values()].sort(compareRankedCandidates);
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
  candidateDiagnostics?: CompanyWebsiteDiscoverySnapshot["candidateDiagnostics"];
  matchedSignals?: string[];
  supportingPageUrls?: string[];
  contactPageUrls?: string[];
  staffPageUrls?: string[];
  extractedEvidence?: string[];
  debugNotes?: string[];
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
    candidateDiagnostics: params.candidateDiagnostics ?? [],
    matchedSignals: params.matchedSignals ?? [],
    supportingPageUrls: params.supportingPageUrls ?? [],
    contactPageUrls: params.contactPageUrls ?? [],
    staffPageUrls: params.staffPageUrls ?? [],
    extractedEvidence: params.extractedEvidence ?? [],
    debugNotes: params.debugNotes ?? [],
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
    candidateDiagnostics: [],
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
  debugNotes?: string[];
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
    candidateDiagnostics: params.snapshot.candidateDiagnostics,
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
    debugNotes: dedupeStrings([
      ...(params.snapshot.debugNotes ?? []),
      ...(params.debugNotes ?? []),
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
    const inferredCandidates = buildDirectDomainCandidates(company);
    const allCandidates = [...searchRun.candidates, ...inferredCandidates];

    for (const candidate of allCandidates) {
      const scored = scoreSearchCandidate(company, candidate);
      const nextCandidate = {
        ...candidate,
        score: scored.score,
        signals: scored.signals,
        signalHits: scored.signalHits,
        signalMisses: scored.signalMisses,
        strongSignalCount: scored.strongSignalCount,
        supportingPageCandidates: [],
        extractedEvidence: [],
        verificationStage: "not_run" as WebsiteDiscoveryCandidateVerificationStage,
        verificationAttemptedUrl: undefined,
        verificationAttemptUrls: [],
        verificationResolvedUrl: undefined,
        canonicalVerifiedUrl: undefined,
        resolvedUrlBecameCanonical: false,
        canonicalRetrySucceeded: false,
        verificationFailureKind: undefined,
        verificationFailureDetail: undefined,
        verificationPageUrls: [],
        verificationEvidence: [],
      } satisfies ScoredSearchCandidate;
      const existing = mergedCandidates.get(candidate.url);

      if (
        !existing ||
        nextCandidate.score > existing.score ||
        (nextCandidate.score === existing.score &&
          existing.sourceType === "direct_domain_inference" &&
          nextCandidate.sourceType === "search_result")
      ) {
        mergedCandidates.set(candidate.url, nextCandidate);
      } else {
        mergedCandidates.set(candidate.url, {
          ...existing,
          signals: dedupeStrings([...existing.signals, ...nextCandidate.signals]),
          signalHits: dedupeStrings([
            ...existing.signalHits,
            ...nextCandidate.signalHits,
          ]),
          signalMisses: dedupeStrings([
            ...existing.signalMisses,
            ...nextCandidate.signalMisses,
          ]),
          strongSignalCount: Math.max(
            existing.strongSignalCount,
            nextCandidate.strongSignalCount,
          ),
          sourceDetail: dedupeStrings([
            existing.sourceDetail,
            nextCandidate.sourceDetail,
          ]).join(" + "),
          sourceType:
            existing.sourceType === "search_result" ||
            nextCandidate.sourceType === "search_result"
              ? "search_result"
              : existing.sourceType,
          isGenericGuess: existing.isGenericGuess && nextCandidate.isGenericGuess,
          verificationStage:
            existing.verificationStage === "lightweight_crawl" ||
            nextCandidate.verificationStage === "lightweight_crawl"
              ? "lightweight_crawl"
              : existing.verificationStage === "homepage" ||
                  nextCandidate.verificationStage === "homepage"
                ? "homepage"
                : "not_run",
          verificationPageUrls: dedupeStrings([
            ...existing.verificationPageUrls,
            ...nextCandidate.verificationPageUrls,
          ]),
          verificationEvidence: dedupeStrings([
            ...existing.verificationEvidence,
            ...nextCandidate.verificationEvidence,
          ]),
          verificationAttemptedUrl:
            existing.verificationAttemptedUrl ?? nextCandidate.verificationAttemptedUrl,
          verificationAttemptUrls: dedupeStrings([
            ...existing.verificationAttemptUrls,
            ...nextCandidate.verificationAttemptUrls,
          ]),
          verificationResolvedUrl:
            nextCandidate.verificationResolvedUrl ?? existing.verificationResolvedUrl,
          canonicalVerifiedUrl:
            nextCandidate.canonicalVerifiedUrl ?? existing.canonicalVerifiedUrl,
          resolvedUrlBecameCanonical:
            existing.resolvedUrlBecameCanonical ||
            nextCandidate.resolvedUrlBecameCanonical,
          canonicalRetrySucceeded:
            existing.canonicalRetrySucceeded || nextCandidate.canonicalRetrySucceeded,
          verificationFailureKind:
            nextCandidate.verificationFailureKind ?? existing.verificationFailureKind,
          verificationFailureDetail:
            nextCandidate.verificationFailureDetail ??
            existing.verificationFailureDetail,
        });
      }
    }

    const candidates = selectCandidatesForReview(
      [...mergedCandidates.values()].filter((candidate) => candidate.score > 0),
    );

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
        candidateDiagnostics: searchRun.candidateDiagnostics.filter(
          (candidate) => candidate.decision === "rejected",
        ),
        debugNotes: buildCandidateDiagnosticDebugNotes(
          searchRun.candidateDiagnostics.filter(
            (candidate) => candidate.decision === "rejected",
          ),
        ),
        lastError: searchRun.errors[0],
        source: searchSource,
      });
    }

    const candidatesToVerify = selectCandidatesForVerification(candidates);
    const verifiedCandidates = await Promise.all(
      candidatesToVerify.map((candidate) =>
        runCandidateVerificationCrawl(company, candidate),
      ),
    );
    const verifiedCandidatesByUrl = new Map(
      candidatesToVerify.map((candidate, index) => [
        candidate.url,
        verifiedCandidates[index] ?? candidate,
      ] as const),
    );
    const rankedCandidates = candidates.map(
      (candidate) => verifiedCandidatesByUrl.get(candidate.url) ?? candidate,
    );
    const finalCandidateDiagnostics = dedupeCandidateDiagnostics([
      ...rankedCandidates.map((candidate) => buildScoredCandidateDiagnostic(candidate)),
      ...searchRun.candidateDiagnostics,
    ]);
    const discoveryDebugNotes = buildCandidateDiagnosticDebugNotes(
      finalCandidateDiagnostics,
    );

    const bestCandidate = [...rankedCandidates].sort(compareRankedCandidates)[0];
    const bestDecision = bestCandidate ? determineCandidateDecision(bestCandidate) : undefined;

    if (!bestCandidate || bestCandidate.score < DISCARD_CANDIDATE_MIN_SCORE) {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confirmationStatus: "not_found",
        confirmationReason:
          bestDecision?.reason ??
          `Rejected below the discard threshold at ${DISCARD_CANDIDATE_MIN_SCORE}/100.`,
        confidenceScore: bestCandidate?.score ?? 0,
        candidateWebsite: undefined,
        candidateUrls: candidates.map((candidate) => candidate.url),
        candidateDiagnostics: finalCandidateDiagnostics,
        matchedSignals: bestCandidate?.signalHits ?? [
          `No candidate cleared the discard threshold of ${DISCARD_CANDIDATE_MIN_SCORE}/100.`,
        ],
        supportingPageUrls: [],
        contactPageUrls: [],
        staffPageUrls: [],
        extractedEvidence: dedupeStrings([
          ...(bestCandidate?.verificationEvidence ?? []),
          ...(bestCandidate?.extractedEvidence ?? []),
        ]),
        debugNotes: discoveryDebugNotes,
        source: createDiscoverySource(now, {
          provider: searchSource.provider,
          label: searchSource.label,
        }),
      });
    }

    if (!bestDecision || bestDecision.decision === "needs_review") {
      return createDiscoverySnapshot({
        now,
        status: "not_found",
        confirmationStatus: "needs_review",
        confirmationReason:
          bestDecision?.reason ??
          "Best website candidate needs operator review before auto-confirmation.",
        confidenceScore: bestCandidate?.score ?? 0,
        candidateWebsite: bestCandidate?.url,
        candidateUrls: candidates.map((candidate) => candidate.url),
        candidateDiagnostics: finalCandidateDiagnostics,
        matchedSignals: dedupeStrings([
          ...(bestCandidate?.signalHits ?? []),
          ...(bestCandidate?.verificationEvidence ?? []),
          bestDecision?.reason ??
            "Best website candidate needs operator review before auto-confirmation.",
        ]),
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
        extractedEvidence: dedupeStrings([
          ...(bestCandidate?.verificationEvidence ?? []),
          ...(bestCandidate?.extractedEvidence ?? []),
          bestDecision?.reason,
        ]),
        debugNotes: discoveryDebugNotes,
        source: createDiscoverySource(now, {
          url: bestCandidate?.url,
          provider: searchSource.provider,
          label: searchSource.label,
        }),
      });
    }

    return createDiscoverySnapshot({
      now,
      status: "discovered",
      confirmationStatus: "auto_confirmed",
      confirmationReason: bestDecision.reason,
      confidenceScore: bestCandidate.score,
      discoveredWebsite: bestCandidate.url,
      candidateWebsite: bestCandidate.url,
      candidateUrls: candidates.map((candidate) => candidate.url),
      candidateDiagnostics: finalCandidateDiagnostics,
      matchedSignals: dedupeStrings([
        ...bestCandidate.signalHits,
        ...bestCandidate.verificationEvidence,
        bestDecision.reason,
      ]),
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
      extractedEvidence: dedupeStrings([
        ...bestCandidate.verificationEvidence,
        ...bestCandidate.extractedEvidence,
      ]),
      debugNotes: discoveryDebugNotes,
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
      candidateDiagnostics: [],
      debugNotes: [],
      lastError:
        error instanceof Error
          ? error.message
          : "Website discovery failed unexpectedly.",
      source: createDiscoverySource(now),
    });
  }
}
