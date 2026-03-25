import { getDataAccess } from "@/lib/data/access";
import {
  applyPrimaryContactSelection,
  assessContactPath,
  buildContactQualitySnapshot,
  getCompanyHost,
  getContactSourceLabel,
} from "@/lib/data/contacts/quality";
import { deriveContactRoleFromTitle } from "@/lib/data/intake/validation";
import { scanCompanyWebsite } from "@/lib/data/enrichment/web";
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

function rankContactDrafts(params: {
  drafts: ContactDraft[];
  company: Company;
  hasWebsiteEvidence: boolean;
  host: string | undefined;
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
  lastError?: string;
  now: string;
}) {
  const hasWebsiteEvidence = params.sourceUrls.length > 0;
  const hasCampaignEligiblePath = Boolean(params.primaryContact?.quality?.campaignEligible);
  const enrichmentSource =
    hasWebsiteEvidence && params.primaryContact
      ? "public_website_and_record"
      : hasWebsiteEvidence
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

  const enrichment: CompanyEnrichmentSnapshot = {
    confidenceLevel: params.confidenceLevel,
    confidenceScore: getConfidenceScore(params.confidenceLevel),
    contactPath: getContactPath(params.primaryContact),
    enrichmentSource,
    sourceUrls: params.sourceUrls,
    pagesChecked: params.pagesChecked,
    foundEmails: params.foundEmails,
    foundPhones: params.foundPhones,
    foundNames: params.foundNames,
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
    : hasWebsiteEvidence ||
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
  ]);
  const scoringReasons = dedupeStrings([
    ...params.company.scoring.reasons,
    hasWebsiteEvidence
      ? `Website enrichment scanned ${params.sourceUrls.length} page${params.sourceUrls.length === 1 ? "" : "s"}`
      : "Website enrichment could not verify the public site",
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
    manualReviewRequired ? "Manual review is still recommended after enrichment." : undefined,
  ]);

  return {
    ...params.company,
    subindustry: params.bestSubindustry ?? params.company.subindustry,
    status: nextStatus,
    primaryContactId: params.primaryContact?.id ?? params.company.primaryContactId,
    presence: {
      ...params.company.presence,
      hasWebsite: Boolean(params.normalizedWebsite),
      websiteUrl: params.normalizedWebsite ?? params.company.presence.websiteUrl,
    },
    painSignals,
    notes,
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
  const websiteScan = await scanCompanyWebsite(company.presence.websiteUrl);
  const host = getCompanyHost(websiteScan.normalizedWebsite ?? company.presence.websiteUrl);
  const drafts = buildWebsiteDrafts({
    company,
    existingContacts: companyContacts,
    now,
    normalizedWebsite: websiteScan.normalizedWebsite,
    sourceUrls: websiteScan.sourceUrls,
    websiteEmails: websiteScan.emails,
    websitePhones: websiteScan.phones,
    namedContacts: websiteScan.namedContacts,
  });
  const hasWebsiteEvidence = websiteScan.sourceUrls.length > 0;
  const rankedContacts = rankContactDrafts({
    drafts,
    company,
    hasWebsiteEvidence,
    host,
    now,
  });
  const confidenceLevel = getConfidenceLevel(
    rankedContacts.primaryContact,
    hasWebsiteEvidence,
  );
  const missingFields = buildMissingFields({
    website: websiteScan.normalizedWebsite ?? company.presence.websiteUrl,
    primaryContact: rankedContacts.primaryContact,
    phone: rankedContacts.primaryContact?.phone ?? websiteScan.phones[0],
    subindustry: company.subindustry ?? websiteScan.categoryClues[0],
    linkedinVerificationNeeded:
      Boolean(rankedContacts.primaryContact?.fullName) &&
      !rankedContacts.primaryContact?.linkedinUrl,
  });
  const updatedCompany = updateCompanyReadiness({
    company,
    primaryContact: rankedContacts.primaryContact,
    normalizedWebsite: websiteScan.normalizedWebsite,
    bestPhone: rankedContacts.primaryContact?.phone ?? websiteScan.phones[0],
    bestSubindustry: company.subindustry ?? websiteScan.categoryClues[0],
    descriptionSnippet: websiteScan.descriptionSnippet,
    confidenceLevel,
    missingFields,
    sourceUrls: websiteScan.sourceUrls,
    pagesChecked: websiteScan.pagesChecked,
    foundEmails: websiteScan.emails,
    foundPhones: websiteScan.phones,
    foundNames: websiteScan.namedContacts.map((candidate) => candidate.fullName),
    lastError: websiteScan.lastError,
    now,
  });
  const dataAccess = getDataAccess();

  await Promise.all(
    rankedContacts.contacts.map((contact) =>
      drafts.find((draft) => draft.id === contact.id)?.isNew
        ? dataAccess.contacts.create(contact)
        : dataAccess.contacts.update(contact),
    ),
  );

  await dataAccess.companies.update(updatedCompany);

  const status: LeadEnrichmentRecordResult["status"] =
    updatedCompany.status === "campaign_ready"
      ? "ready"
      : updatedCompany.status === "enriched"
        ? "needs_review"
        : websiteScan.lastError
          ? "failed"
          : "needs_enrichment";
  const readinessReason = rankedContacts.primaryContact?.quality?.campaignEligible
    ? rankedContacts.primaryContact.fullName
      ? "Named company-domain contact is ready for outreach"
      : "Exact-domain business inbox is ready for outreach"
    : rankedContacts.primaryContact?.quality?.warnings[0] ??
      "No strong contact path is ready for outreach yet";

  return {
    companyId: company.id,
    companyName: company.name,
    status,
    message:
      status === "ready"
        ? "Company is now campaign-eligible."
        : status === "needs_review"
          ? "Website enrichment improved the record, but an operator should review it."
          : status === "needs_enrichment"
            ? "The record still needs more enrichment before outreach."
            : websiteScan.lastError ?? "Website enrichment failed for this company.",
    confidenceLevel,
    missingFields,
    foundEmails: websiteScan.emails,
    foundPhones: websiteScan.phones,
    pagesChecked: websiteScan.sourceUrls,
    primaryContactId: rankedContacts.primaryContact?.id,
    primaryContactLabel:
      rankedContacts.primaryContact?.fullName ??
      rankedContacts.primaryContact?.email ??
      rankedContacts.primaryContact?.phone,
    primaryContactSource: rankedContacts.primaryContact
      ? getContactSourceLabel(rankedContacts.primaryContact)
      : undefined,
    primaryContactQuality: rankedContacts.primaryContact?.quality?.qualityTier,
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
          .filter((company) => company.status === "new")
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
        pagesChecked: [],
        primaryContactSource: undefined,
        primaryContactQuality: undefined,
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
    results,
  };
}
