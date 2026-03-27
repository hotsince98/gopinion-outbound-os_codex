import { getDataAccess } from "@/lib/data/access";
import {
  classifyCompanyOutreachAngle,
  prioritizeRecommendedOfferIds,
} from "@/lib/data/company/outreach-angle";
import { classifyCompanySegment } from "@/lib/data/company/segment";
import {
  applyPrimaryContactSelection,
  assessContactPath,
  buildContactQualitySnapshot,
  getCompanyHost,
  getContactSourceLabel,
} from "@/lib/data/contacts/quality";
import {
  buildRecordProvidedDiscoverySnapshot,
  discoverCompanyWebsite,
  mergeWebsiteDiscoveryEvidence,
  selectPreferredSupportingPage,
} from "@/lib/data/enrichment/discovery";
import {
  getConfiguredEnrichmentProvider,
  scanCompanyWebsiteWithProvider,
} from "@/lib/data/enrichment/provider";
import type { WebsiteScanResult } from "@/lib/data/enrichment/web";
import { parseImportedNoteArtifacts } from "@/lib/data/intake/notes";
import {
  deriveContactRoleFromTitle,
  normalizeWebsiteUrl,
} from "@/lib/data/intake/validation";
import type {
  Company,
  CompanyEnrichmentSnapshot,
  CompanyId,
  Contact,
  ContactId,
  ContactPathKind,
  ContactQualityTier,
  EnrichmentConfidenceLevel,
  EnrichmentContactPath,
  LeadEnrichmentRecordResult,
  LeadEnrichmentRunScope,
  LeadEnrichmentRunSummary,
} from "@/lib/domain";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function createContactId() {
  return `contact_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as ContactId;
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase();
}

function normalizePhone(phone: string | undefined) {
  return phone?.replace(/[^\d+]/g, "");
}

function emailLikelyMatchesName(email: string | undefined, fullName: string | undefined) {
  const localPart = normalizeEmail(email)?.split("@")[0] ?? "";
  const tokens = fullName
    ?.toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ""))
    .filter(Boolean) ?? [];
  const [firstName] = tokens;
  const lastName = tokens.at(-1);

  if (!firstName) {
    return false;
  }

  return (
    localPart.includes(firstName) ||
    Boolean(lastName && localPart.includes(lastName))
  );
}

function getContactPath(contact: Contact | undefined): EnrichmentContactPath {
  switch (contact?.quality?.pathKind) {
    case "named_email":
      return "named_contact";
    case "role_inbox":
    case "general_business_email":
      return "role_inbox";
    case "phone_only":
      return "phone_only";
    case "unknown":
    default:
      return "none";
  }
}

function getConfidenceLevel(
  contact: Contact | undefined,
  hasWebsiteEvidence: boolean,
): EnrichmentConfidenceLevel {
  const tier = contact?.quality?.qualityTier;

  if (hasWebsiteEvidence && tier === "strong") {
    return "high";
  }

  if (hasWebsiteEvidence && tier === "usable") {
    return "medium";
  }

  if (
    hasWebsiteEvidence ||
    tier === "weak" ||
    Boolean(contact?.email || contact?.phone || contact?.fullName)
  ) {
    return "low";
  }

  return "none";
}

function getConfidenceScore(level: EnrichmentConfidenceLevel) {
  switch (level) {
    case "high":
      return 92;
    case "medium":
      return 76;
    case "low":
      return 54;
    case "none":
      return 24;
  }
}

function buildMissingFields(params: {
  website: string | undefined;
  primaryContact: Contact | undefined;
  phone: string | undefined;
  subindustry: string | undefined;
  linkedinVerificationNeeded: boolean;
}) {
  const missingFields: string[] = [];

  if (!params.website) {
    missingFields.push("website");
  }

  if (!params.primaryContact?.quality?.campaignEligible) {
    missingFields.push("verified outreach email");
  }

  if (!params.phone) {
    missingFields.push("phone");
  }

  if (!params.primaryContact?.fullName) {
    missingFields.push("named contact");
  }

  if (!params.subindustry) {
    missingFields.push("subindustry");
  }

  if (params.linkedinVerificationNeeded) {
    missingFields.push("linkedin verification");
  }

  return missingFields;
}

function createEnrichmentSource(now: string, url: string | undefined) {
  return {
    kind: "system_inference" as const,
    provider: "website_enrichment",
    label: "Website enrichment",
    url,
    observedAt: now,
  };
}

const ENRICHMENT_SYSTEM_NOTE_PREFIXES = [
  "Website summary:",
  "Manual review is still recommended after enrichment.",
];

function getImportedNoteLines(company: Company) {
  return (company.notes ?? []).filter((line) => {
    const trimmed = line.trim();

    return (
      trimmed.length > 0 &&
      !ENRICHMENT_SYSTEM_NOTE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
    );
  });
}

function buildWebsiteDiscoverySummary(
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"],
  resolvedWebsite: string | undefined,
) {
  const evidencePreview = dedupeStrings(
    websiteDiscovery?.extractedEvidence.slice(0, 2) ?? [],
  ).join(" • ");
  const confidencePreview = websiteDiscovery
    ? `${websiteDiscovery.confidenceLevel} confidence (${websiteDiscovery.confidenceScore}/100)`
    : undefined;
  const preferredSupportingPageLabel = websiteDiscovery?.preferredSupportingPage
    ? `Preferred ${websiteDiscovery.preferredSupportingPage.kind} page (${websiteDiscovery.preferredSupportingPage.source.replaceAll("_", " ")}): ${websiteDiscovery.preferredSupportingPage.url}`
    : undefined;

  if (!websiteDiscovery) {
    return resolvedWebsite
      ? `Website candidate is ${resolvedWebsite}`
      : "Website discovery has not run yet";
  }

  if (
    websiteDiscovery.confirmationStatus === "needs_review" &&
    websiteDiscovery.candidateWebsite
  ) {
    return [
      `Website candidate needs review: ${websiteDiscovery.candidateWebsite}`,
      websiteDiscovery.confirmationReason,
      confidencePreview,
      preferredSupportingPageLabel,
      evidencePreview,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" • ");
  }

  if (
    websiteDiscovery.confirmationStatus === "operator_confirmed" &&
    websiteDiscovery.discoveredWebsite
  ) {
    return [
      `Operator-confirmed website: ${websiteDiscovery.discoveredWebsite}`,
      websiteDiscovery.confirmationReason,
      confidencePreview,
      preferredSupportingPageLabel,
      evidencePreview,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" • ");
  }

  if (
    websiteDiscovery.confirmationStatus === "rejected" &&
    websiteDiscovery.candidateWebsite
  ) {
    return [
      `Rejected website candidate: ${websiteDiscovery.candidateWebsite}`,
      websiteDiscovery.confirmationReason,
      confidencePreview,
      preferredSupportingPageLabel,
      evidencePreview,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" • ");
  }

  switch (websiteDiscovery.status) {
    case "record_provided":
      return [
        `Website is already on record: ${websiteDiscovery.discoveredWebsite ?? resolvedWebsite ?? "pending verification"}`,
        websiteDiscovery.confirmationReason,
        confidencePreview,
        websiteDiscovery.staffPageUrls.length > 0
          ? `${websiteDiscovery.staffPageUrls.length} staff/team page${
              websiteDiscovery.staffPageUrls.length === 1 ? "" : "s"
            } found`
          : undefined,
        websiteDiscovery.contactPageUrls.length > 0
          ? `${websiteDiscovery.contactPageUrls.length} contact page${
              websiteDiscovery.contactPageUrls.length === 1 ? "" : "s"
            } found`
          : undefined,
        preferredSupportingPageLabel,
        evidencePreview,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ");
    case "discovered":
      return [
        `Auto-confirmed website: ${websiteDiscovery.discoveredWebsite ?? "a likely public site"}`,
        websiteDiscovery.confirmationReason,
        confidencePreview,
        websiteDiscovery.staffPageUrls.length > 0
          ? `${websiteDiscovery.staffPageUrls.length} staff/team page${
              websiteDiscovery.staffPageUrls.length === 1 ? "" : "s"
            } found`
          : undefined,
        websiteDiscovery.contactPageUrls.length > 0
          ? `${websiteDiscovery.contactPageUrls.length} contact page${
              websiteDiscovery.contactPageUrls.length === 1 ? "" : "s"
            } found`
          : undefined,
        preferredSupportingPageLabel,
        evidencePreview,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ");
    case "not_found":
      return websiteDiscovery.candidateWebsite
        ? `Website candidate still needs review: ${websiteDiscovery.candidateWebsite}`
        : "Website discovery could not find a confident public site";
    case "failed":
      return websiteDiscovery.lastError
        ? `Website discovery failed: ${websiteDiscovery.lastError}`
        : "Website discovery failed";
    case "not_checked":
    default:
      return resolvedWebsite
        ? `Website candidate is ${resolvedWebsite}`
        : "Website discovery has not run yet";
  }
}

function buildNoteHintSummary(noteHints: CompanyEnrichmentSnapshot["noteHints"]) {
  if (noteHints.length === 0) {
    return "No structured hints parsed from imported notes";
  }

  const counts = {
    contacts: noteHints.filter((hint) => hint.kind === "contact_name").length,
    emails: noteHints.filter((hint) => hint.kind === "email").length,
    phones: noteHints.filter((hint) => hint.kind === "phone").length,
    observations: noteHints.filter((hint) => hint.kind === "observation").length,
  };

  return dedupeStrings([
    counts.contacts > 0
      ? `${counts.contacts} contact hint${counts.contacts === 1 ? "" : "s"}`
      : undefined,
    counts.emails > 0
      ? `${counts.emails} email hint${counts.emails === 1 ? "" : "s"}`
      : undefined,
    counts.phones > 0
      ? `${counts.phones} phone hint${counts.phones === 1 ? "" : "s"}`
      : undefined,
    counts.observations > 0
      ? `${counts.observations} operator note${counts.observations === 1 ? "" : "s"}`
      : undefined,
  ]).join(" • ");
}

type WebsiteInputStatus = NonNullable<
  NonNullable<CompanyEnrichmentSnapshot["providerRun"]>["inputStatus"]
>;
type WebsiteInputSource = NonNullable<
  NonNullable<CompanyEnrichmentSnapshot["providerRun"]>["inputSource"]
>;

interface WebsiteEnrichmentInputContext {
  website?: string;
  status: WebsiteInputStatus;
  source: WebsiteInputSource;
  candidateWebsite?: string;
}

function isProviderOnlyEvidence(value: string | undefined) {
  if (!value) {
    return false;
  }

  return /^(Scrapling transport:|Scrapling endpoint:|Scrapling worker entry:|Scrapling fallback reason:|Scrapling worker fallback:)/iu.test(
    value,
  );
}

function filterDiscoveryEvidence(values: Array<string | undefined>) {
  return dedupeStrings(values).filter((value) => !isProviderOnlyEvidence(value));
}

export function resolveWebsiteEnrichmentInput(params: {
  company: Company;
  noteWebsite?: string;
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"];
}) {
  const recordWebsite = normalizeWebsiteUrl(params.company.presence.websiteUrl);
  const noteWebsite = normalizeWebsiteUrl(params.noteWebsite);
  const confirmedDiscoveryWebsite =
    params.websiteDiscovery?.confirmationStatus &&
    ["record_provided", "auto_confirmed", "operator_confirmed"].includes(
      params.websiteDiscovery.confirmationStatus,
    )
      ? normalizeWebsiteUrl(params.websiteDiscovery.discoveredWebsite)
      : undefined;
  const candidateWebsite =
    params.websiteDiscovery?.confirmationStatus === "needs_review"
      ? normalizeWebsiteUrl(params.websiteDiscovery.candidateWebsite)
      : undefined;

  if (recordWebsite) {
    return {
      website: recordWebsite,
      status: "confirmed_website",
      source: "company_record",
    } satisfies WebsiteEnrichmentInputContext;
  }

  if (noteWebsite) {
    return {
      website: noteWebsite,
      status: "confirmed_website",
      source: "imported_notes",
    } satisfies WebsiteEnrichmentInputContext;
  }

  if (confirmedDiscoveryWebsite) {
    return {
      website: confirmedDiscoveryWebsite,
      status: "confirmed_website",
      source: "discovery_confirmed",
    } satisfies WebsiteEnrichmentInputContext;
  }

  if (candidateWebsite) {
    return {
      website: undefined,
      candidateWebsite,
      status: "candidate_website",
      source: "discovery_candidate",
    } satisfies WebsiteEnrichmentInputContext;
  }

  return {
    website: undefined,
    status: "no_website",
    source: "none",
  } satisfies WebsiteEnrichmentInputContext;
}

function buildProviderInputEvidence(params: {
  input: WebsiteEnrichmentInputContext;
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"];
  websiteScan: WebsiteScanResult;
}) {
  if (params.input.status === "confirmed_website") {
    return dedupeStrings([
      params.input.website
        ? `Crawler input: confirmed website ${params.input.website}`
        : undefined,
      params.websiteScan.normalizedWebsite
        ? `Crawler actual website: ${params.websiteScan.normalizedWebsite}`
        : undefined,
      params.websiteScan.sourceUrls.length > 0
        ? `Crawler fetched ${params.websiteScan.sourceUrls.length} public page${
            params.websiteScan.sourceUrls.length === 1 ? "" : "s"
          }`
        : undefined,
      params.websiteScan.staffPageUrls.length > 0
        ? `Crawler found ${params.websiteScan.staffPageUrls.length} staff/team page${
            params.websiteScan.staffPageUrls.length === 1 ? "" : "s"
          }`
        : undefined,
      params.websiteScan.contactPageUrls.length > 0
        ? `Crawler found ${params.websiteScan.contactPageUrls.length} contact page${
            params.websiteScan.contactPageUrls.length === 1 ? "" : "s"
          }`
        : undefined,
    ]);
  }

  if (params.input.status === "candidate_website") {
    return dedupeStrings([
      params.input.candidateWebsite
        ? `Crawler input held pending candidate review: ${params.input.candidateWebsite}`
        : undefined,
      params.websiteDiscovery?.confirmationStatus
        ? `Candidate status at run: ${params.websiteDiscovery.confirmationStatus.replaceAll("_", " ")}`
        : undefined,
    ]);
  }

  return [
    "Crawler input missing: discovery did not produce a confirmed website",
  ];
}

function buildDiscoveryEvidenceFromWebsiteScan(websiteScan: WebsiteScanResult) {
  return filterDiscoveryEvidence([
    websiteScan.normalizedWebsite && websiteScan.sourceUrls.length > 0
      ? `Website crawl verified ${websiteScan.normalizedWebsite}`
      : undefined,
    websiteScan.staffPageUrls.length > 0
      ? `${websiteScan.staffPageUrls.length} staff/team page${
          websiteScan.staffPageUrls.length === 1 ? "" : "s"
        } surfaced during crawl`
      : undefined,
    websiteScan.contactPageUrls.length > 0
      ? `${websiteScan.contactPageUrls.length} contact page${
          websiteScan.contactPageUrls.length === 1 ? "" : "s"
        } surfaced during crawl`
      : undefined,
  ]);
}

function buildNoWebsiteInputScanResult(params: {
  input: WebsiteEnrichmentInputContext;
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"];
}): WebsiteScanResult {
  const requestedProvider = getConfiguredEnrichmentProvider();
  const providerEvidence =
    params.input.status === "candidate_website"
      ? dedupeStrings([
          params.input.candidateWebsite
            ? `Crawler input held pending candidate review: ${params.input.candidateWebsite}`
            : undefined,
          params.websiteDiscovery?.confirmationStatus
            ? `Candidate status at run: ${params.websiteDiscovery.confirmationStatus.replaceAll(
                "_",
                " ",
              )}`
            : undefined,
        ])
      : ["Crawler input missing: discovery did not produce a confirmed website"];

  return {
    requestedProvider,
    actualProvider: requestedProvider,
    fallbackUsed: false,
    fallbackReason: undefined,
    crawlAttempted: false,
    providerEvidence,
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
    lastError:
      params.input.status === "candidate_website"
        ? "Website discovery found a candidate, but it still needs confirmation before crawl."
        : params.websiteDiscovery?.lastError ??
          "Website discovery did not produce a confirmed website to crawl.",
  };
}

function buildProviderRunSnapshot(params: {
  input: WebsiteEnrichmentInputContext;
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"];
  websiteScan: WebsiteScanResult;
  now: string;
}) {
  const requestedProvider = params.websiteScan.requestedProvider ?? "basic";
  const actualProvider = params.websiteScan.actualProvider ?? requestedProvider;

  return {
    requestedProvider,
    actualProvider,
    fallbackUsed: params.websiteScan.fallbackUsed ?? requestedProvider !== actualProvider,
    fallbackReason: params.websiteScan.fallbackReason,
    transportUsed: params.websiteScan.transportUsed,
    transportTarget: params.websiteScan.transportTarget,
    transportSucceeded: params.websiteScan.transportSucceeded,
    crawlAttempted:
      params.websiteScan.crawlAttempted ?? params.input.status === "confirmed_website",
    inputStatus: params.input.status,
    inputSource: params.input.source,
    inputWebsite: params.input.website ?? params.input.candidateWebsite,
    crawledWebsite: params.websiteScan.normalizedWebsite,
    evidence: dedupeStrings([
      ...buildProviderInputEvidence({
        input: params.input,
        websiteDiscovery: params.websiteDiscovery,
        websiteScan: params.websiteScan,
      }),
      ...(params.websiteScan.providerEvidence ?? []),
    ]),
    lastRunAt: params.now,
  } satisfies NonNullable<CompanyEnrichmentSnapshot["providerRun"]>;
}

function getPreferredSupportingPageUrls(
  websiteDiscovery: CompanyEnrichmentSnapshot["websiteDiscovery"],
) {
  return dedupeStrings([
    websiteDiscovery?.preferredSupportingPage?.url,
    ...(websiteDiscovery?.staffPageUrls ?? []),
    ...(websiteDiscovery?.contactPageUrls ?? []),
    ...(websiteDiscovery?.supportingPageUrls ?? []),
  ]);
}

interface ContactDraft {
  id: ContactId;
  isNew: boolean;
  wasPrimary: boolean;
  fullName?: string;
  title?: string;
  role: Contact["role"];
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceKind: Contact["sourceKind"];
  source: Contact["source"];
  notes: string[];
  createdAt: string;
}

interface RankedContactDraft {
  draft: ContactDraft;
  rankScore: number;
  qualityTier: ContactQualityTier;
  campaignEligible: boolean;
  warnings: string[];
  selectionReasons: string[];
  status: Contact["status"];
  confidenceScore: number;
  pathKind: ContactPathKind;
}

function findDraftByEmail(drafts: ContactDraft[], email: string | undefined) {
  const normalized = normalizeEmail(email);

  return drafts.find((draft) => normalizeEmail(draft.email) === normalized);
}

function findDraftByName(drafts: ContactDraft[], fullName: string | undefined) {
  const normalized = fullName?.trim().toLowerCase();

  return normalized
    ? drafts.find((draft) => draft.fullName?.trim().toLowerCase() === normalized)
    : undefined;
}

function findDraftByPhone(drafts: ContactDraft[], phone: string | undefined) {
  const normalized = normalizePhone(phone);

  return normalized
    ? drafts.find((draft) => normalizePhone(draft.phone) === normalized)
    : undefined;
}

function buildBaseDrafts(existingContacts: Contact[]): ContactDraft[] {
  return existingContacts.map((contact) => ({
    id: contact.id,
    isNew: false,
    wasPrimary: contact.isPrimary,
    fullName: contact.fullName,
    title: contact.title,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    sourceKind: contact.sourceKind,
    source: contact.source,
    notes: [...contact.notes],
    createdAt: contact.createdAt,
  }));
}

function buildWebsiteDrafts(params: {
  company: Company;
  existingContacts: Contact[];
  now: string;
  normalizedWebsite?: string;
  sourceUrls: string[];
  websiteEmails: string[];
  websitePhones: string[];
  namedContacts: Array<{ fullName: string; title?: string; sourceUrl: string }>;
}) {
  const drafts = buildBaseDrafts(params.existingContacts);
  const primarySourceUrl = params.sourceUrls[0] ?? params.normalizedWebsite;
  const bestPhone = params.websitePhones[0];

  for (const email of params.websiteEmails) {
    const matchingName = params.namedContacts.find((candidate) =>
      emailLikelyMatchesName(email, candidate.fullName),
    );
    const existingDraft =
      findDraftByEmail(drafts, email) ??
      (matchingName ? findDraftByName(drafts, matchingName.fullName) : undefined);

    if (existingDraft) {
      existingDraft.email = existingDraft.email ?? email;
      existingDraft.fullName = existingDraft.fullName ?? matchingName?.fullName;
      existingDraft.title = existingDraft.title ?? matchingName?.title;
      existingDraft.role = existingDraft.title
        ? deriveContactRoleFromTitle(existingDraft.title)
        : existingDraft.role;
      existingDraft.notes = dedupeStrings([
        ...existingDraft.notes,
        `Website enrichment confirmed contact path: ${email}`,
        matchingName?.title ? `Website enrichment found title: ${matchingName.title}` : undefined,
      ]);
      continue;
    }

    drafts.push({
      id: createContactId(),
      isNew: true,
      wasPrimary: false,
      fullName: matchingName?.fullName,
      title: matchingName?.title,
      role: matchingName?.title
        ? deriveContactRoleFromTitle(matchingName.title)
        : "unknown",
      email,
      phone: undefined,
      linkedinUrl: undefined,
      sourceKind: "observed",
      source: createEnrichmentSource(params.now, matchingName?.sourceUrl ?? primarySourceUrl),
      notes: dedupeStrings([
        `Website enrichment discovered contact path: ${email}`,
        matchingName?.fullName
          ? `Website enrichment associated this inbox with ${matchingName.fullName}`
          : undefined,
      ]),
      createdAt: params.now,
    });
  }

  for (const namedContact of params.namedContacts) {
    const existingDraft =
      findDraftByName(drafts, namedContact.fullName) ??
      drafts.find((draft) => emailLikelyMatchesName(draft.email, namedContact.fullName));

    if (existingDraft) {
      existingDraft.fullName = existingDraft.fullName ?? namedContact.fullName;
      existingDraft.title = existingDraft.title ?? namedContact.title;
      existingDraft.role = existingDraft.title
        ? deriveContactRoleFromTitle(existingDraft.title)
        : existingDraft.role;

      if (!existingDraft.phone && !existingDraft.email && bestPhone) {
        existingDraft.phone = bestPhone;
      }

      existingDraft.notes = dedupeStrings([
        ...existingDraft.notes,
        `Website enrichment found named contact: ${namedContact.fullName}`,
        namedContact.title ? `Website enrichment found title: ${namedContact.title}` : undefined,
      ]);
      continue;
    }

    if (!bestPhone) {
      continue;
    }

    drafts.push({
      id: createContactId(),
      isNew: true,
      wasPrimary: false,
      fullName: namedContact.fullName,
      title: namedContact.title,
      role: namedContact.title
        ? deriveContactRoleFromTitle(namedContact.title)
        : "unknown",
      email: undefined,
      phone: bestPhone,
      linkedinUrl: undefined,
      sourceKind: "observed",
      source: createEnrichmentSource(params.now, namedContact.sourceUrl),
      notes: [
        `Website enrichment found a phone fallback for ${namedContact.fullName}.`,
      ],
      createdAt: params.now,
    });
  }

  if (bestPhone && !findDraftByPhone(drafts, bestPhone)) {
    drafts.push({
      id: createContactId(),
      isNew: true,
      wasPrimary: false,
      fullName: undefined,
      title: "Main line",
      role: "unknown",
      email: undefined,
      phone: bestPhone,
      linkedinUrl: undefined,
      sourceKind: "observed",
      source: createEnrichmentSource(params.now, primarySourceUrl),
      notes: ["Website enrichment found the main business phone line."],
      createdAt: params.now,
    });
  }

  return drafts;
}

function mergeNoteDrafts(params: {
  drafts: ContactDraft[];
  noteArtifacts: ReturnType<typeof parseImportedNoteArtifacts>;
  normalizedWebsite?: string;
  now: string;
}) {
  const drafts = params.drafts.map((draft) => ({
    ...draft,
    notes: [...draft.notes],
  }));

  for (const candidate of params.noteArtifacts.candidateContacts) {
    const existingDraft =
      findDraftByEmail(drafts, candidate.email) ??
      findDraftByName(drafts, candidate.fullName) ??
      findDraftByPhone(drafts, candidate.phone);

    if (existingDraft) {
      existingDraft.fullName = existingDraft.fullName ?? candidate.fullName;
      existingDraft.title = existingDraft.title ?? candidate.title;
      existingDraft.role = existingDraft.title
        ? deriveContactRoleFromTitle(existingDraft.title)
        : existingDraft.role;
      existingDraft.email = existingDraft.email ?? candidate.email;
      existingDraft.phone = existingDraft.phone ?? candidate.phone;
      existingDraft.notes = dedupeStrings([
        ...existingDraft.notes,
        ...candidate.notes,
        "Imported notes contributed a possible contact path",
      ]);
      continue;
    }

    if (!candidate.email && !candidate.phone && !candidate.fullName) {
      continue;
    }

    drafts.push({
      id: createContactId(),
      isNew: true,
      wasPrimary: false,
      fullName: candidate.fullName,
      title: candidate.title,
      role: candidate.title
        ? deriveContactRoleFromTitle(candidate.title)
        : "unknown",
      email: candidate.email,
      phone: candidate.phone,
      linkedinUrl: undefined,
      sourceKind: "inferred",
      source: candidate.source,
      notes: dedupeStrings([
        ...candidate.notes,
        candidate.requiresReview
          ? "Imported notes should be verified before outreach"
          : undefined,
      ]),
      createdAt: params.now,
    });
  }

  if (
    params.noteArtifacts.suggestedPhone &&
    !findDraftByPhone(drafts, params.noteArtifacts.suggestedPhone)
  ) {
    drafts.push({
      id: createContactId(),
      isNew: true,
      wasPrimary: false,
      fullName: undefined,
      title: "Imported main line",
      role: "unknown",
      email: undefined,
      phone: params.noteArtifacts.suggestedPhone,
      linkedinUrl: undefined,
      sourceKind: "inferred",
      source:
        params.noteArtifacts.candidateContacts[0]?.source ?? createEnrichmentSource(
          params.now,
          params.normalizedWebsite,
        ),
      notes: ["Imported notes surfaced a possible main phone line."],
      createdAt: params.now,
    });
  }

  return drafts;
}

function rankContactDrafts(params: {
  drafts: ContactDraft[];
  company: Company;
  hasWebsiteEvidence: boolean;
  host: string | undefined;
  angleKey?: NonNullable<CompanyEnrichmentSnapshot["outreachAngle"]>["key"];
  now: string;
}) {
  const ranked = params.drafts.map((draft) => {
    const assessment = assessContactPath({
      email: draft.email,
      phone: draft.phone,
      fullName: draft.fullName,
      title: draft.title,
      companyHost: params.host,
      source: draft.source,
      hasWebsiteEvidence: params.hasWebsiteEvidence,
      preferCurrentPrimary:
        draft.wasPrimary || params.company.primaryContactId === draft.id,
    });

    return {
      draft,
      rankScore: assessment.rankScore,
      qualityTier: assessment.qualityTier,
      campaignEligible: assessment.campaignEligible,
      warnings: assessment.warnings,
      selectionReasons: assessment.selectionReasons,
      status: assessment.status,
      confidenceScore: assessment.confidenceScore,
      pathKind: assessment.pathKind,
    } satisfies RankedContactDraft;
  });

  const persistedContacts = ranked.map((candidate) => {
    const quality = buildContactQualitySnapshot(
      {
        rankScore: candidate.rankScore,
        qualityTier: candidate.qualityTier,
        pathKind: candidate.pathKind,
        campaignEligible: candidate.campaignEligible,
        warnings: candidate.warnings,
        selectionReasons: candidate.selectionReasons,
      },
      params.now,
    );

    return {
      id: candidate.draft.id,
      companyId: params.company.id,
      fullName: candidate.draft.fullName,
      title: candidate.draft.title,
      role: candidate.draft.title
        ? deriveContactRoleFromTitle(candidate.draft.title)
        : candidate.draft.role,
      email: candidate.draft.email,
      phone: candidate.draft.phone,
      linkedinUrl: candidate.draft.linkedinUrl,
      sourceKind: candidate.draft.sourceKind,
      status: candidate.status,
      isPrimary: false,
      outreachReady: quality.campaignEligible,
      confidence: {
        score: candidate.confidenceScore,
        signals: dedupeStrings([
          ...candidate.selectionReasons,
          ...quality.warnings,
        ]),
      },
      quality,
      notes: dedupeStrings([
        ...candidate.draft.notes,
      ]),
      source: candidate.draft.source,
      createdAt: candidate.draft.createdAt,
      updatedAt: params.now,
    } satisfies Contact;
  });

  return applyPrimaryContactSelection({
    contacts: persistedContacts,
    preferredContactId: params.company.primaryContactId,
    companyHost:
      params.host ??
      getCompanyHost(
        params.company.presence.websiteUrl ??
          params.company.enrichment?.websiteDiscovery?.discoveredWebsite,
      ) ??
      getCompanyHost(params.company.enrichment?.websiteDiscovery?.candidateWebsite),
    angleKey: params.angleKey,
    now: params.now,
  });
}

function updateCompanyReadiness(params: {
  company: Company;
  primaryContact?: Contact;
  normalizedWebsite?: string;
  bestPhone?: string;
  bestSubindustry?: string;
  descriptionSnippet?: string;
  confidenceLevel: EnrichmentConfidenceLevel;
  missingFields: string[];
  sourceUrls: string[];
  pagesChecked: string[];
  foundEmails: string[];
  foundPhones: string[];
  foundNames: string[];
  websiteDiscovery?: CompanyEnrichmentSnapshot["websiteDiscovery"];
  providerRun?: CompanyEnrichmentSnapshot["providerRun"];
  noteHints: CompanyEnrichmentSnapshot["noteHints"];
  segment?: CompanyEnrichmentSnapshot["segment"];
  lastError?: string;
  now: string;
}) {
  const hasWebsiteEvidence = params.sourceUrls.length > 0;
  const hasWebsiteCandidate = Boolean(
    params.normalizedWebsite ?? params.websiteDiscovery?.discoveredWebsite,
  );
  const hasReviewableWebsiteCandidate = Boolean(
    params.websiteDiscovery?.confirmationStatus === "needs_review" &&
      params.websiteDiscovery.candidateWebsite,
  );
  const hasCampaignEligiblePath = Boolean(params.primaryContact?.quality?.campaignEligible);
  const enrichmentSource =
    hasWebsiteCandidate && params.primaryContact
      ? "public_website_and_record"
      : hasWebsiteCandidate
        ? "public_website"
        : "record_only";
  const linkedinVerificationNeeded =
    Boolean(params.primaryContact?.fullName) && !params.primaryContact?.linkedinUrl;
  const manualReviewRequired =
    !hasCampaignEligiblePath ||
    params.primaryContact?.quality?.qualityTier === "weak" ||
    params.primaryContact?.quality?.qualityTier === "junk" ||
    linkedinVerificationNeeded ||
    params.missingFields.length > 2;
  const nextPresence = {
    ...params.company.presence,
    hasWebsite: hasWebsiteCandidate,
    websiteUrl: params.normalizedWebsite ?? params.company.presence.websiteUrl,
    primaryPhone: params.bestPhone ?? params.company.presence.primaryPhone,
  };
  const outreachAngle = classifyCompanyOutreachAngle({
    presence: nextPresence,
    segment: params.segment ?? params.company.enrichment?.segment,
    primaryContact: params.primaryContact,
    manualReviewRequired,
    now: params.now,
  });

  const enrichment: CompanyEnrichmentSnapshot = {
    confidenceLevel: params.confidenceLevel,
    confidenceScore: getConfidenceScore(params.confidenceLevel),
    contactPath: getContactPath(params.primaryContact),
    enrichmentSource,
    providerRun: params.providerRun,
    sourceUrls: params.sourceUrls,
    pagesChecked: params.pagesChecked,
    foundEmails: params.foundEmails,
    foundPhones: params.foundPhones,
    foundNames: params.foundNames,
    websiteDiscovery: params.websiteDiscovery,
    noteHints:
      params.noteHints.length > 0
        ? params.noteHints
        : params.company.enrichment?.noteHints ?? [],
    segment: params.segment ?? params.company.enrichment?.segment,
    outreachAngle,
    descriptionSnippet: params.descriptionSnippet,
    missingFields: params.missingFields,
    manualReviewRequired,
    linkedinVerificationNeeded,
    linkedinVerified: params.company.enrichment?.linkedinVerified ?? false,
    lastEnrichedAt: params.now,
    lastAttemptedAt: params.now,
    lastError: params.lastError,
  };

  const nextStatus: Company["status"] = hasCampaignEligiblePath
    ? "campaign_ready"
    : hasWebsiteCandidate ||
        hasReviewableWebsiteCandidate ||
        params.bestSubindustry ||
        params.bestPhone ||
        params.primaryContact
      ? "enriched"
      : "new";
  const painSignals = dedupeStrings([
    ...params.company.painSignals.filter(
      (signal) =>
        signal !== "Website still needs verification" &&
        signal !== "New lead intake still needs enrichment and qualification",
    ),
    !hasCampaignEligiblePath
      ? "No campaign-eligible contact path was confirmed during enrichment"
      : undefined,
    !params.primaryContact?.fullName && hasCampaignEligiblePath
      ? "Campaign can start from a role inbox, but a named owner still needs review"
      : undefined,
    nextStatus === "new" ? "Website enrichment still needs operator follow-up" : undefined,
    hasReviewableWebsiteCandidate
      ? "Search discovery found a likely official website that still needs confirmation"
      : undefined,
  ]);
  const scoringReasons = dedupeStrings([
    ...params.company.scoring.reasons,
    hasWebsiteEvidence
      ? `Website enrichment scanned ${params.sourceUrls.length} page${params.sourceUrls.length === 1 ? "" : "s"}`
      : hasWebsiteCandidate
        ? "Website was identified but still needs manual verification"
        : hasReviewableWebsiteCandidate
          ? "Search discovery found a likely official website that still needs operator confirmation"
          : "Website enrichment could not verify the public site",
    params.websiteDiscovery?.status === "discovered"
      ? `Website discovery identified ${params.websiteDiscovery.discoveredWebsite}`
      : undefined,
    params.websiteDiscovery?.confirmationStatus === "needs_review" &&
    params.websiteDiscovery.candidateWebsite
      ? `Website candidate awaiting review: ${params.websiteDiscovery.candidateWebsite}`
      : undefined,
    params.websiteDiscovery?.staffPageUrls.length
      ? `Supporting staff/team pages found: ${params.websiteDiscovery.staffPageUrls.length}`
      : undefined,
    params.websiteDiscovery?.contactPageUrls.length
      ? `Supporting contact pages found: ${params.websiteDiscovery.contactPageUrls.length}`
      : undefined,
    params.websiteDiscovery?.preferredSupportingPage
      ? `Preferred supporting page reused: ${params.websiteDiscovery.preferredSupportingPage.url}`
      : undefined,
    params.providerRun
      ? `Enrichment provider run: ${params.providerRun.actualProvider}${
          params.providerRun.fallbackUsed && params.providerRun.requestedProvider !== params.providerRun.actualProvider
            ? ` (requested ${params.providerRun.requestedProvider}, fallback used)`
            : ""
        }${
          params.providerRun.transportUsed
            ? ` via ${params.providerRun.transportUsed}`
            : ""
        }`
      : undefined,
    params.providerRun?.fallbackReason
      ? `Provider fallback reason: ${params.providerRun.fallbackReason}`
      : undefined,
    params.foundNames.length > 0
      ? `Named contact clues surfaced: ${params.foundNames.slice(0, 3).join(", ")}`
      : undefined,
    `Recommended outreach angle: ${outreachAngle.label}`,
    params.primaryContact?.email
      ? `Primary outreach path selected: ${params.primaryContact.email}`
      : params.primaryContact?.phone
        ? `Primary outreach path selected: ${params.primaryContact.phone}`
        : "No usable contact email found during enrichment",
    params.primaryContact?.quality?.qualityTier
      ? `Primary contact quality: ${params.primaryContact.quality.qualityTier}`
      : undefined,
    params.bestSubindustry
      ? `Subindustry inferred as ${params.bestSubindustry}`
      : undefined,
  ]);
  const outreachReadinessScore = clampScore(
    params.company.scoring.outreachReadinessScore +
      (hasCampaignEligiblePath ? 18 : 0) +
      (hasWebsiteEvidence ? 10 : 0) +
      (params.primaryContact?.fullName ? 8 : 0),
  );
  const notes = dedupeStrings([
    ...(params.company.notes ?? []),
    params.descriptionSnippet ? `Website summary: ${params.descriptionSnippet}` : undefined,
    `Current outreach angle: ${outreachAngle.label} (${outreachAngle.shortReason})`,
    manualReviewRequired ? "Manual review is still recommended after enrichment." : undefined,
  ]);

  return {
    ...params.company,
    subindustry: params.bestSubindustry ?? params.company.subindustry,
    status: nextStatus,
    primaryContactId: params.primaryContact?.id ?? params.company.primaryContactId,
    presence: nextPresence,
    painSignals,
    notes,
    recommendedOfferIds: prioritizeRecommendedOfferIds(
      outreachAngle.recommendedFirstOfferId,
      params.company.recommendedOfferIds,
    ),
    scoring: {
      ...params.company.scoring,
      outreachReadinessScore,
      reasons: scoringReasons,
    },
    enrichment,
    updatedAt: params.now,
  };
}

async function enrichSingleCompany(
  company: Company,
  companyContacts: Contact[],
): Promise<LeadEnrichmentRecordResult> {
  const now = new Date().toISOString();
  const noteArtifacts = parseImportedNoteArtifacts(getImportedNoteLines(company), now);
  const noteWebsiteSource = noteArtifacts.hints.find(
    (hint) => hint.kind === "website",
  )?.source;
  const previousWebsiteDiscovery = company.enrichment?.websiteDiscovery;
  const normalizedRecordedWebsite = normalizeWebsiteUrl(company.presence.websiteUrl);
  const normalizedPreviousWebsite = normalizeWebsiteUrl(
    previousWebsiteDiscovery?.discoveredWebsite ??
      previousWebsiteDiscovery?.candidateWebsite,
  );
  const baseWebsiteDiscovery = company.presence.websiteUrl
    ? normalizedRecordedWebsite &&
      normalizedPreviousWebsite &&
      normalizedRecordedWebsite === normalizedPreviousWebsite
      ? mergeWebsiteDiscoveryEvidence({
          snapshot: previousWebsiteDiscovery!,
          now,
          lastError: undefined,
        })
      : buildRecordProvidedDiscoverySnapshot({
          website: company.presence.websiteUrl,
          now,
          source: company.source,
          matchedSignals: ["Website was already present on the company record"],
        })
    : noteArtifacts.suggestedWebsite
      ? buildRecordProvidedDiscoverySnapshot({
          website: noteArtifacts.suggestedWebsite,
          now,
          source: noteWebsiteSource ?? company.source,
          matchedSignals: ["Website surfaced from imported notes"],
        })
      : previousWebsiteDiscovery?.discoveredWebsite ||
          previousWebsiteDiscovery?.preferredSupportingPage?.url
        ? previousWebsiteDiscovery
      : await discoverCompanyWebsite(
          {
            ...company,
            presence: {
              ...company.presence,
              primaryPhone:
                company.presence.primaryPhone ?? noteArtifacts.suggestedPhone,
            },
          },
          now,
        );
  const websiteDiscovery =
    previousWebsiteDiscovery && previousWebsiteDiscovery !== baseWebsiteDiscovery
      ? mergeWebsiteDiscoveryEvidence({
          snapshot: baseWebsiteDiscovery,
          now,
          supportingPageUrls: previousWebsiteDiscovery.supportingPageUrls,
          contactPageUrls: previousWebsiteDiscovery.contactPageUrls,
          staffPageUrls: previousWebsiteDiscovery.staffPageUrls,
          extractedEvidence: filterDiscoveryEvidence(
            previousWebsiteDiscovery.extractedEvidence,
          ),
          preferredSupportingPage: previousWebsiteDiscovery.preferredSupportingPage,
          confirmationStatus: previousWebsiteDiscovery.confirmationStatus,
          confirmationReason: previousWebsiteDiscovery.confirmationReason,
          operatorReview: previousWebsiteDiscovery.operatorReview,
          lastError: baseWebsiteDiscovery.lastError,
        })
      : baseWebsiteDiscovery;
  const websiteInput = resolveWebsiteEnrichmentInput({
    company,
    noteWebsite: noteArtifacts.suggestedWebsite,
    websiteDiscovery,
  });
  const resolvedWebsite = websiteInput.website;
  const websiteScan = resolvedWebsite
    ? await scanCompanyWebsiteWithProvider({
        website: resolvedWebsite,
        preferredPageUrls: getPreferredSupportingPageUrls(websiteDiscovery),
      })
    : buildNoWebsiteInputScanResult({
        input: websiteInput,
        websiteDiscovery,
      });
  const providerRun = buildProviderRunSnapshot({
    input: websiteInput,
    websiteDiscovery,
    websiteScan,
    now,
  });
  const normalizedWebsite = websiteScan.normalizedWebsite ?? resolvedWebsite;
  const host = getCompanyHost(normalizedWebsite);
  const foundEmails = dedupeStrings([
    ...noteArtifacts.hints
      .filter((hint) => hint.kind === "email")
      .map((hint) => hint.value),
    ...websiteScan.emails,
  ]);
  const foundPhones = dedupeStrings([
    company.presence.primaryPhone,
    noteArtifacts.suggestedPhone,
    ...noteArtifacts.hints
      .filter((hint) => hint.kind === "phone")
      .map((hint) => hint.value),
    ...websiteScan.phones,
  ]);
  const foundNames = dedupeStrings([
    ...noteArtifacts.hints
      .filter((hint) => hint.kind === "contact_name")
      .map((hint) => hint.value),
    ...websiteScan.namedContacts.map((candidate) => candidate.fullName),
  ]);
  const preferredSupportingPage = selectPreferredSupportingPage({
    now,
    current: websiteDiscovery.preferredSupportingPage,
    supportingPageUrls: dedupeStrings([
      ...websiteScan.supportingPageUrls,
      ...websiteDiscovery.supportingPageUrls,
    ]),
    contactPageUrls: dedupeStrings([
      ...websiteScan.contactPageUrls,
      ...websiteDiscovery.contactPageUrls,
    ]),
    staffPageUrls: dedupeStrings([
      ...websiteScan.staffPageUrls,
      ...websiteDiscovery.staffPageUrls,
    ]),
    extractedEvidence: dedupeStrings([
      ...filterDiscoveryEvidence(websiteDiscovery.extractedEvidence),
      ...buildDiscoveryEvidenceFromWebsiteScan(websiteScan),
    ]),
  });
  const enrichedWebsiteDiscovery = mergeWebsiteDiscoveryEvidence({
    snapshot: websiteDiscovery,
    now,
    supportingPageUrls: websiteScan.supportingPageUrls,
    contactPageUrls: websiteScan.contactPageUrls,
    staffPageUrls: websiteScan.staffPageUrls,
    extractedEvidence: buildDiscoveryEvidenceFromWebsiteScan(websiteScan),
    preferredSupportingPage,
    lastError: websiteScan.lastError,
  });
  const drafts = buildWebsiteDrafts({
    company,
    existingContacts: companyContacts,
    now,
    normalizedWebsite,
    sourceUrls: websiteScan.sourceUrls,
    websiteEmails: websiteScan.emails,
    websitePhones: websiteScan.phones,
    namedContacts: websiteScan.namedContacts,
  });
  const mergedDrafts = mergeNoteDrafts({
    drafts,
    noteArtifacts,
    normalizedWebsite,
    now,
  });
  const hasWebsiteEvidence = websiteScan.sourceUrls.length > 0;
  const provisionalPhone =
    foundPhones[0] ??
    company.presence.primaryPhone;
  const provisionalSegment = classifyCompanySegment({
    presence: {
      ...company.presence,
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: provisionalPhone,
    },
    softwareToolCountEstimate: company.softwareToolCountEstimate,
    now,
  });
  const provisionalOutreachAngle = classifyCompanyOutreachAngle({
    presence: {
      ...company.presence,
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: provisionalPhone,
    },
    segment: provisionalSegment,
    primaryContact: undefined,
    manualReviewRequired: true,
    now,
  });
  const rankedContacts = rankContactDrafts({
    drafts: mergedDrafts,
    company,
    hasWebsiteEvidence,
    host,
    angleKey:
      company.enrichment?.outreachAngle?.key ?? provisionalOutreachAngle.key,
    now,
  });
  const confidenceLevel = getConfidenceLevel(
    rankedContacts.primaryContact,
    hasWebsiteEvidence,
  );
  const bestPhone =
    rankedContacts.primaryContact?.phone ??
    foundPhones[0] ??
    company.presence.primaryPhone;
  const bestSubindustry = company.subindustry ?? websiteScan.categoryClues[0];
  const segment = classifyCompanySegment({
    presence: {
      ...company.presence,
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: bestPhone,
    },
    softwareToolCountEstimate: company.softwareToolCountEstimate,
    now,
  });
  const missingFields = buildMissingFields({
    website: normalizedWebsite,
    primaryContact: rankedContacts.primaryContact,
    phone: bestPhone,
    subindustry: bestSubindustry,
    linkedinVerificationNeeded:
      Boolean(rankedContacts.primaryContact?.fullName) &&
      !rankedContacts.primaryContact?.linkedinUrl,
  });
  const updatedCompany = updateCompanyReadiness({
    company,
    primaryContact: rankedContacts.primaryContact,
    normalizedWebsite,
    bestPhone,
    bestSubindustry,
    descriptionSnippet: websiteScan.descriptionSnippet,
    confidenceLevel,
    missingFields,
    sourceUrls: websiteScan.sourceUrls,
    pagesChecked: websiteScan.pagesChecked,
    foundEmails,
    foundPhones,
    foundNames,
    websiteDiscovery: enrichedWebsiteDiscovery,
    providerRun,
    noteHints: noteArtifacts.hints,
    segment,
    lastError: websiteScan.lastError,
    now,
  });
  const dataAccess = getDataAccess();

  await Promise.all(
    rankedContacts.contacts.map((contact) =>
      mergedDrafts.find((draft) => draft.id === contact.id)?.isNew
        ? dataAccess.contacts.create(contact)
        : dataAccess.contacts.update(contact),
    ),
  );

  await dataAccess.companies.update(updatedCompany);

  const hasReviewableWebsiteCandidate = Boolean(
    enrichedWebsiteDiscovery.confirmationStatus === "needs_review" &&
      enrichedWebsiteDiscovery.candidateWebsite,
  );
  const noUsablePath =
    !normalizedWebsite &&
    !bestPhone &&
    !rankedContacts.primaryContact &&
    foundEmails.length === 0;
  const status: LeadEnrichmentRecordResult["status"] =
    updatedCompany.status === "campaign_ready"
      ? "ready"
      : noUsablePath &&
          ["failed", "not_found"].includes(websiteDiscovery.status)
        && !hasReviewableWebsiteCandidate
        && enrichedWebsiteDiscovery.staffPageUrls.length === 0
        && enrichedWebsiteDiscovery.contactPageUrls.length === 0
        ? "blocked"
        : hasReviewableWebsiteCandidate
          ? "needs_review"
        : updatedCompany.status === "enriched"
          ? "needs_review"
          : "needs_enrichment";
  const readinessReason =
    status === "blocked"
      ? "Still blocked because no website, phone, or primary contact path was verified."
      : hasReviewableWebsiteCandidate
        ? `Needs review because discovery found a likely website candidate (${enrichedWebsiteDiscovery.candidateWebsite}) that still needs confirmation.`
      : rankedContacts.primaryContact?.quality?.campaignEligible
        ? rankedContacts.primaryContact.fullName
          ? "Ready because a named company-domain contact was selected."
          : "Ready because an exact-domain business inbox was selected."
        : !normalizedWebsite
          ? "Needs enrichment because the company still has no verified website on record."
          : rankedContacts.primaryContact?.quality?.warnings[0] ??
            "No strong contact path is ready for outreach yet.";

  return {
    companyId: company.id,
    companyName: company.name,
    status,
    message:
      status === "ready"
        ? "Company is now campaign-eligible."
        : status === "needs_review"
          ? hasReviewableWebsiteCandidate
            ? "Discovery found a likely official website, but an operator should confirm it before crawling."
            : "Website enrichment improved the record, but an operator should review it."
          : status === "blocked"
            ? "The record is still blocked because no usable public contact path was found."
            : status === "needs_enrichment"
            ? "The record still needs more enrichment before outreach."
            : websiteScan.lastError ?? "Website enrichment failed for this company.",
    confidenceLevel,
    missingFields,
    foundEmails,
    foundPhones,
    pagesChecked: websiteScan.pagesChecked,
    website: normalizedWebsite,
    websiteDiscoveryCandidate:
      enrichedWebsiteDiscovery.candidateWebsite ??
      enrichedWebsiteDiscovery.discoveredWebsite,
    websiteDiscoveryStatus: enrichedWebsiteDiscovery.status,
    websiteDiscoveryConfirmationStatus:
      enrichedWebsiteDiscovery.confirmationStatus,
    websiteDiscoveryConfidenceLevel: enrichedWebsiteDiscovery.confidenceLevel,
    websiteDiscoveryConfidenceScore: enrichedWebsiteDiscovery.confidenceScore,
    websiteDiscoverySummary: buildWebsiteDiscoverySummary(
      enrichedWebsiteDiscovery,
      normalizedWebsite,
    ),
    discoveryEvidence: enrichedWebsiteDiscovery.extractedEvidence,
    staffPageUrls: enrichedWebsiteDiscovery.staffPageUrls,
    contactPageUrls: enrichedWebsiteDiscovery.contactPageUrls,
    preferredSupportingPageUrl: enrichedWebsiteDiscovery.preferredSupportingPage?.url,
    preferredSupportingPageSource:
      enrichedWebsiteDiscovery.preferredSupportingPage?.source,
    preferredSupportingPageReason:
      enrichedWebsiteDiscovery.preferredSupportingPage?.reason,
    foundNames,
    noteHintSummary: buildNoteHintSummary(noteArtifacts.hints),
    segmentLabel: segment.label,
    angleLabel: updatedCompany.enrichment?.outreachAngle?.label,
    angleReason: updatedCompany.enrichment?.outreachAngle?.shortReason,
    angleUrgency: updatedCompany.enrichment?.outreachAngle?.urgency,
    angleConfidenceLevel: updatedCompany.enrichment?.outreachAngle?.confidenceLevel,
    angleReviewPath: updatedCompany.enrichment?.outreachAngle?.reviewPath,
    recommendedFirstOfferId:
      updatedCompany.enrichment?.outreachAngle?.recommendedFirstOfferId,
    importedAt: company.createdAt,
    lastEnrichedAt: updatedCompany.enrichment?.lastEnrichedAt,
    providerRequested: providerRun.requestedProvider,
    providerUsed: providerRun.actualProvider,
    providerFallbackUsed: providerRun.fallbackUsed,
    providerFallbackReason: providerRun.fallbackReason,
    providerCrawlAttempted: providerRun.crawlAttempted,
    providerInputStatus: providerRun.inputStatus,
    providerInputWebsite: providerRun.inputWebsite,
    providerCrawledWebsite: providerRun.crawledWebsite,
    providerEvidence: providerRun.evidence,
    primaryContactId: rankedContacts.primaryContact?.id,
    primaryContactLabel:
      rankedContacts.primaryContact?.fullName ??
      rankedContacts.primaryContact?.email ??
      rankedContacts.primaryContact?.phone,
    primaryContactSource: rankedContacts.primaryContact
      ? getContactSourceLabel(rankedContacts.primaryContact)
      : undefined,
    primaryContactQuality: rankedContacts.primaryContact?.quality?.qualityTier,
    primaryContactSelectionReason:
      rankedContacts.primaryContact?.quality?.selectionReasons[0],
    secondaryContactLabels: rankedContacts.contacts
      .filter((contact) => !contact.isPrimary)
      .slice(0, 1)
      .map(
        (contact) =>
          contact.fullName ?? contact.email ?? contact.phone ?? "Secondary contact",
      ),
    backupContactLabels: rankedContacts.contacts
      .filter((contact) => !contact.isPrimary)
      .slice(1, 4)
      .map(
        (contact) =>
          contact.fullName ?? contact.email ?? contact.phone ?? "Backup contact",
      ),
    qualityWarnings: rankedContacts.primaryContact?.quality?.warnings ?? [],
    readinessReason,
  };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function runLeadEnrichment(params: {
  scope: LeadEnrichmentRunScope;
  companyIds?: CompanyId[];
}): Promise<LeadEnrichmentRunSummary> {
  const dataAccess = getDataAccess();
  const [companies, contacts] = await Promise.all([
    dataAccess.companies.list(),
    dataAccess.contacts.list(),
  ]);
  const targetCompanyIds =
    params.scope === "queue"
      ? companies
          .filter(
            (company) =>
              company.status === "new" ||
              company.status === "enriched" ||
              company.enrichment?.manualReviewRequired,
          )
          .map((company) => company.id)
      : dedupeStrings((params.companyIds ?? []) as string[]).map((id) => id as CompanyId);
  const targets = companies.filter((company) => targetCompanyIds.includes(company.id));
  const results: LeadEnrichmentRecordResult[] = [];

  for (const group of chunk(targets, 3)) {
    const settled = await Promise.allSettled(
      group.map((company) =>
        enrichSingleCompany(
          company,
          contacts.filter((contact) => contact.companyId === company.id),
        ),
      ),
    );

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
        return;
      }

      const company = group[index];
      results.push({
        companyId: company.id,
        companyName: company.name,
        status: "failed",
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "Website enrichment failed unexpectedly.",
        confidenceLevel: company.enrichment?.confidenceLevel ?? "none",
        missingFields: company.enrichment?.missingFields ?? ["website enrichment"],
        foundEmails: [],
        foundPhones: [],
        foundNames: [],
        pagesChecked: [],
        discoveryEvidence: [],
        staffPageUrls: [],
        contactPageUrls: [],
        preferredSupportingPageUrl: undefined,
        preferredSupportingPageSource: undefined,
        preferredSupportingPageReason: undefined,
        primaryContactSource: undefined,
        primaryContactQuality: undefined,
        primaryContactSelectionReason: undefined,
        providerRequested: undefined,
        providerUsed: undefined,
        providerFallbackUsed: false,
        providerFallbackReason: undefined,
        providerEvidence: [],
        secondaryContactLabels: [],
        backupContactLabels: [],
        qualityWarnings: [],
        readinessReason: "The enrichment run failed before a contact path could be evaluated.",
      });
    });
  }

  return {
    scope: params.scope,
    processedCount: results.length,
    updatedCount: results.filter((result) => result.status !== "failed").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    readyCount: results.filter((result) => result.status === "ready").length,
    needsReviewCount: results.filter((result) => result.status === "needs_review").length,
    stillNeedsEnrichmentCount: results.filter(
      (result) => result.status === "needs_enrichment",
    ).length,
    blockedCount: results.filter((result) => result.status === "blocked").length,
    results,
  };
}
