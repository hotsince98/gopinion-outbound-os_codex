import { getDataAccess } from "@/lib/data/access";
import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import { deriveContactRoleFromTitle } from "@/lib/data/intake/validation";
import { scanCompanyWebsite } from "@/lib/data/enrichment/web";
import type {
  Company,
  CompanyEnrichmentSnapshot,
  CompanyId,
  Contact,
  ContactId,
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

function getCompanyHost(website: string | undefined) {
  const normalized = normalizeWebsiteUrl(website);

  if (!normalized) {
    return undefined;
  }

  return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
}

function isRoleInbox(email: string) {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";

  return [
    "info",
    "sales",
    "contact",
    "hello",
    "team",
    "office",
    "support",
    "service",
  ].includes(localPart);
}

function isSameCompanyDomain(email: string, host: string | undefined) {
  if (!host) {
    return false;
  }

  const emailHost = email.split("@")[1]?.replace(/^www\./, "").toLowerCase();

  return emailHost === host || emailHost?.endsWith(`.${host}`) || host.endsWith(`.${emailHost}`);
}

function scoreEmail(email: string, host: string | undefined) {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const emailHost = email.split("@")[1]?.toLowerCase() ?? "";
  const sameDomain = isSameCompanyDomain(email, host);
  const roleInbox = isRoleInbox(email);

  let score = 10;

  if (sameDomain) {
    score += 50;
  }

  if (roleInbox) {
    score += 16;
  } else {
    score += 24;
  }

  if (["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(emailHost)) {
    score -= 24;
  }

  if (["noreply", "no-reply", "donotreply", "admin"].includes(localPart)) {
    score -= 40;
  }

  return score;
}

function chooseBestEmail(emails: string[], host: string | undefined) {
  return [...emails].sort((left, right) => scoreEmail(right, host) - scoreEmail(left, host))[0];
}

function getContactPath(
  namedContact: string | undefined,
  email: string | undefined,
  phone: string | undefined,
): EnrichmentContactPath {
  if (namedContact && email) {
    return "named_contact";
  }

  if (email) {
    return isRoleInbox(email) ? "role_inbox" : "named_contact";
  }

  if (phone) {
    return "phone_only";
  }

  return "none";
}

function getConfidenceLevel(
  namedContact: string | undefined,
  email: string | undefined,
  host: string | undefined,
  hasWebsiteEvidence: boolean,
): EnrichmentConfidenceLevel {
  if (
    namedContact &&
    email &&
    isSameCompanyDomain(email, host) &&
    hasWebsiteEvidence &&
    !isRoleInbox(email)
  ) {
    return "high";
  }

  if (email && isSameCompanyDomain(email, host) && hasWebsiteEvidence) {
    return "medium";
  }

  if (email || namedContact || hasWebsiteEvidence) {
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
  email: string | undefined;
  phone: string | undefined;
  fullName: string | undefined;
  subindustry: string | undefined;
  linkedinVerificationNeeded: boolean;
}) {
  const missingFields: string[] = [];

  if (!params.website) {
    missingFields.push("website");
  }

  if (!params.email) {
    missingFields.push("contact email");
  }

  if (!params.phone) {
    missingFields.push("phone");
  }

  if (!params.fullName) {
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

function choosePrimaryContact(existingContacts: Contact[], company: Company) {
  return (
    existingContacts.find((contact) => contact.id === company.primaryContactId) ??
    existingContacts.find((contact) => contact.isPrimary) ??
    existingContacts[0]
  );
}

function buildUpdatedContact(params: {
  company: Company;
  existingPrimaryContact?: Contact;
  bestEmail?: string;
  bestPhone?: string;
  bestName?: string;
  bestTitle?: string;
  confidenceLevel: EnrichmentConfidenceLevel;
  confidenceSignals: string[];
  sourceUrl?: string;
  now: string;
}) {
  const { existingPrimaryContact, company } = params;
  const role = params.bestTitle
    ? deriveContactRoleFromTitle(params.bestTitle)
    : params.bestEmail && isRoleInbox(params.bestEmail)
      ? "unknown"
      : existingPrimaryContact?.role ?? "unknown";
  const status =
    params.bestEmail && scoreEmail(params.bestEmail, getCompanyHost(company.presence.websiteUrl)) >= 40
      ? "verified"
      : "candidate";
  const notes = dedupeStrings([
    ...(existingPrimaryContact?.notes ?? []),
    params.bestEmail ? `Website enrichment confirmed contact path: ${params.bestEmail}` : undefined,
    params.bestPhone ? `Website enrichment found phone: ${params.bestPhone}` : undefined,
    params.bestTitle ? `Website enrichment found title: ${params.bestTitle}` : undefined,
  ]);

  const baseContact: Contact = {
    id: existingPrimaryContact?.id ?? createContactId(),
    companyId: company.id,
    fullName: params.bestName ?? existingPrimaryContact?.fullName,
    title: params.bestTitle ?? existingPrimaryContact?.title,
    role,
    email: params.bestEmail ?? existingPrimaryContact?.email,
    phone: params.bestPhone ?? existingPrimaryContact?.phone,
    linkedinUrl: existingPrimaryContact?.linkedinUrl,
    sourceKind: "observed",
    status,
    isPrimary: true,
    outreachReady: Boolean(params.bestEmail ?? existingPrimaryContact?.email),
    confidence: {
      score: getConfidenceScore(params.confidenceLevel) / 100,
      signals: params.confidenceSignals,
    },
    notes,
    source: createEnrichmentSource(params.now, params.sourceUrl),
    createdAt: existingPrimaryContact?.createdAt ?? params.now,
    updatedAt: params.now,
  };

  return {
    contact: baseContact,
    isNew: !existingPrimaryContact,
  };
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
  const hasUsableContactPath = Boolean(params.primaryContact?.email);
  const enrichmentSource =
    hasWebsiteEvidence && params.primaryContact
      ? "public_website_and_record"
      : hasWebsiteEvidence
        ? "public_website"
        : "record_only";
  const linkedinVerificationNeeded =
    Boolean(params.primaryContact?.fullName) && !params.primaryContact?.linkedinUrl;
  const manualReviewRequired =
    params.confidenceLevel !== "high" ||
    linkedinVerificationNeeded ||
    params.missingFields.length > 2;

  const enrichment: CompanyEnrichmentSnapshot = {
    confidenceLevel: params.confidenceLevel,
    confidenceScore: getConfidenceScore(params.confidenceLevel),
    contactPath: getContactPath(
      params.primaryContact?.fullName,
      params.primaryContact?.email,
      params.primaryContact?.phone ?? params.bestPhone,
    ),
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

  const nextStatus: Company["status"] = hasUsableContactPath
    ? "campaign_ready"
    : hasWebsiteEvidence || params.bestSubindustry || params.bestPhone
      ? "enriched"
      : "new";
  const painSignals = dedupeStrings([
    ...params.company.painSignals.filter(
      (signal) =>
        signal !== "Website still needs verification" &&
        signal !== "New lead intake still needs enrichment and qualification",
    ),
    !params.primaryContact?.email ? "No usable email path was found during enrichment" : undefined,
    !params.primaryContact?.fullName && params.primaryContact?.email
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
      ? `Usable contact path found: ${params.primaryContact.email}`
      : "No usable contact email found during enrichment",
    params.bestSubindustry
      ? `Subindustry inferred as ${params.bestSubindustry}`
      : undefined,
  ]);
  const outreachReadinessScore = clampScore(
    params.company.scoring.outreachReadinessScore +
      (params.primaryContact?.email ? 18 : 0) +
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
  const primaryContact = choosePrimaryContact(companyContacts, company);
  const combinedEmails = dedupeStrings([
    primaryContact?.email,
    ...companyContacts.map((contact) => contact.email),
    ...websiteScan.emails,
  ]);
  const bestEmail = chooseBestEmail(combinedEmails, host);
  const bestPhone = primaryContact?.phone ?? websiteScan.phones[0];
  const namedCandidate = websiteScan.namedContacts[0];
  const bestName = primaryContact?.fullName ?? namedCandidate?.fullName;
  const bestTitle = primaryContact?.title ?? namedCandidate?.title;
  const hasWebsiteEvidence = websiteScan.sourceUrls.length > 0;
  const confidenceLevel = getConfidenceLevel(
    bestName,
    bestEmail,
    host,
    hasWebsiteEvidence,
  );
  const confidenceSignals = dedupeStrings([
    hasWebsiteEvidence
      ? `Scanned ${websiteScan.sourceUrls.length} public page${websiteScan.sourceUrls.length === 1 ? "" : "s"}`
      : undefined,
    bestEmail ? `Best contact email: ${bestEmail}` : undefined,
    bestPhone ? `Phone available: ${bestPhone}` : undefined,
    bestName ? `Named contact identified: ${bestName}` : undefined,
  ]);
  const contactPayload =
    bestEmail || bestPhone || bestName
      ? buildUpdatedContact({
          company,
          existingPrimaryContact: primaryContact,
          bestEmail,
          bestPhone,
          bestName,
          bestTitle,
          confidenceLevel,
          confidenceSignals,
          sourceUrl: websiteScan.sourceUrls[0] ?? websiteScan.normalizedWebsite,
          now,
        })
      : undefined;
  const missingFields = buildMissingFields({
    website: websiteScan.normalizedWebsite ?? company.presence.websiteUrl,
    email: contactPayload?.contact.email ?? primaryContact?.email,
    phone: contactPayload?.contact.phone ?? primaryContact?.phone,
    fullName: contactPayload?.contact.fullName ?? primaryContact?.fullName,
    subindustry: company.subindustry ?? websiteScan.categoryClues[0],
    linkedinVerificationNeeded:
      Boolean(contactPayload?.contact.fullName ?? primaryContact?.fullName) &&
      !(contactPayload?.contact.linkedinUrl ?? primaryContact?.linkedinUrl),
  });
  const updatedCompany = updateCompanyReadiness({
    company,
    primaryContact: contactPayload?.contact ?? primaryContact,
    normalizedWebsite: websiteScan.normalizedWebsite,
    bestPhone,
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

  if (contactPayload?.isNew) {
    await dataAccess.contacts.create(contactPayload.contact);
  } else if (contactPayload?.contact) {
    await dataAccess.contacts.update(contactPayload.contact);
  }

  await dataAccess.companies.update(updatedCompany);

  const status: LeadEnrichmentRecordResult["status"] =
    updatedCompany.status === "campaign_ready"
      ? "ready"
      : updatedCompany.status === "enriched"
        ? "needs_review"
        : websiteScan.lastError
          ? "failed"
          : "needs_enrichment";

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
    primaryContactId: contactPayload?.contact.id ?? primaryContact?.id,
    primaryContactLabel:
      contactPayload?.contact.fullName ??
      contactPayload?.contact.email ??
      primaryContact?.fullName ??
      primaryContact?.email,
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
