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
} from "@/lib/data/contacts/quality";
import { initialIcpProfiles } from "@/lib/data/config/icp";
import { buildRecordProvidedDiscoverySnapshot } from "@/lib/data/enrichment/discovery";
import { parseImportedNoteArtifacts } from "@/lib/data/intake/notes";
import { priorityTierDefinitions, scoringBuckets } from "@/lib/data/config/priority-tiers";
import type {
  Company,
  Contact,
  CompanyEnrichmentSnapshot,
  LeadCreationResult,
  LeadDuplicateCheck,
  LeadImportSummary,
  LeadIntakeFieldErrors,
  LeadIntakeInput,
} from "@/lib/domain";
import {
  deriveContactRoleFromTitle,
  getLeadIntakeIssueMessages,
  hasContactInput,
  normalizeCompanyNameForComparison,
  normalizeWebsiteUrl,
  splitIntakeNotes,
  validateLeadIntakeInput,
} from "@/lib/data/intake/validation";
import type { ParsedLeadCsvRow } from "@/lib/data/intake/csv";

export interface CreateLeadOutcome {
  status: "success" | "validation_error" | "duplicate";
  message: string;
  fieldErrors?: LeadIntakeFieldErrors;
  duplicateCheck?: LeadDuplicateCheck;
  result?: LeadCreationResult;
}

const primaryIcpProfile =
  initialIcpProfiles.find(
    (profile) => profile.id === "icp_primary_used_car_dealer",
  ) ?? initialIcpProfiles[0];
const secondaryIcpProfile =
  initialIcpProfiles.find(
    (profile) => profile.id === "icp_secondary_used_car_dealer",
  ) ?? initialIcpProfiles[0];

function createEntityId(prefix: "company" | "contact") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as
    | Company["id"]
    | Contact["id"];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function getScoreBucket(score: number) {
  return (
    scoringBuckets.find(
      (bucket) => score >= bucket.minScore && score <= bucket.maxScore,
    ) ?? scoringBuckets[scoringBuckets.length - 1]
  );
}

function getPriorityTier(score: number) {
  return (
    priorityTierDefinitions.find(
      (definition) =>
        score >= (definition.scoreRange.min ?? 0) &&
        score <= (definition.scoreRange.max ?? 100),
    ) ?? priorityTierDefinitions[priorityTierDefinitions.length - 1]
  );
}

function calculateInitialFitScore(
  input: LeadIntakeInput,
  normalizedWebsite: string | undefined,
) {
  let score = 42;

  if (normalizedWebsite) {
    score += 16;
  }

  if (input.subindustry) {
    score += 4;
  }

  if (input.googleRating != null) {
    score +=
      input.googleRating >= (primaryIcpProfile.googleRatingRange.min ?? 0) &&
      input.googleRating <= (primaryIcpProfile.googleRatingRange.max ?? 5)
        ? 12
        : 7;
  }

  if (input.reviewCount != null) {
    score +=
      input.reviewCount >= (primaryIcpProfile.reviewCountRange.min ?? 0) &&
      input.reviewCount <= (primaryIcpProfile.reviewCountRange.max ?? 500)
        ? 12
        : input.reviewCount > 0
          ? 6
          : 0;
  }

  if (hasContactInput(input)) {
    score += 8;
  }

  if (input.contactEmail) {
    score += 8;
  }

  return clampScore(score);
}

function deriveIcpProfileId(
  input: LeadIntakeInput,
  normalizedWebsite: string | undefined,
  fitScore: number,
) {
  if (
    normalizedWebsite &&
    (input.googleRating != null || input.reviewCount != null) &&
    fitScore >= 72
  ) {
    return primaryIcpProfile.id;
  }

  return secondaryIcpProfile.id;
}

function buildPainSignals(
  input: LeadIntakeInput,
  normalizedWebsite: string | undefined,
  segmentLabel?: string,
  angleLabel?: string,
) {
  const painSignals: string[] = [];

  if (!normalizedWebsite) {
    painSignals.push("Website still needs verification");
  }

  if (input.googleRating != null && input.googleRating <= 4.0) {
    painSignals.push("Visible room to improve public reputation signals");
  }

  if (input.reviewCount != null && input.reviewCount < 15) {
    painSignals.push("Review volume is still relatively light");
  }

  if (
    input.googleRating != null &&
    input.reviewCount != null &&
    input.googleRating >= 4.4 &&
    input.reviewCount >= 60
  ) {
    painSignals.push(
      "Strong review profile suggests an optimization or control angle rather than basic rescue",
    );
  }

  if (segmentLabel) {
    painSignals.push(`Initial segment: ${segmentLabel}`);
  }

  if (angleLabel) {
    painSignals.push(`Initial outreach angle: ${angleLabel}`);
  }

  if (painSignals.length === 0) {
    painSignals.push("New lead intake still needs enrichment and qualification");
  }

  return dedupeStrings(painSignals);
}

function buildScoringReasons(
  input: LeadIntakeInput,
  normalizedWebsite: string | undefined,
  fitScore: number,
  segmentLabel?: string,
  angleLabel?: string,
) {
  const reasons = [
    normalizedWebsite
      ? "Website is present"
      : "Website still needs verification",
    input.contactEmail
      ? "Primary contact email is available"
      : "Primary contact still needs verification",
    input.reviewCount != null || input.googleRating != null
      ? "Public review signals are available"
      : "Public review signals still need enrichment",
  ];

  reasons.push(`Initial intake fit score set to ${fitScore}`);
  if (segmentLabel) {
    reasons.push(`Initial segment assigned: ${segmentLabel}`);
  }

  if (angleLabel) {
    reasons.push(`Initial outreach angle assigned: ${angleLabel}`);
  }

  return reasons;
}

function buildSourceReference(input: LeadIntakeInput, now: string) {
  return {
    kind: input.sourceKind === "csv" ? "import" : "manual",
    provider: input.sourceKind === "csv" ? "csv_upload" : "operator_intake",
    label: input.sourceKind === "csv" ? "CSV lead import" : "Manual lead intake",
    url: normalizeWebsiteUrl(input.website),
    observedAt: now,
  } satisfies Company["source"];
}

function buildCompanyRecord(
  input: LeadIntakeInput,
  primaryContactId: Company["primaryContactId"],
  enrichment: CompanyEnrichmentSnapshot,
): Company {
  const now = new Date().toISOString();
  const normalizedWebsite =
    normalizeWebsiteUrl(input.website) ??
    enrichment.websiteDiscovery?.discoveredWebsite;
  const fitScore = calculateInitialFitScore(input, normalizedWebsite);
  const scoringBucket = getScoreBucket(fitScore);
  const priorityTier = getPriorityTier(fitScore);
  const icpProfileId = deriveIcpProfileId(input, normalizedWebsite, fitScore);
  const segment = classifyCompanySegment({
    presence: {
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: input.phone,
      hasClaimedGoogleBusinessProfile:
        input.googleRating != null || input.reviewCount != null,
      googleRating: input.googleRating,
      reviewCount: input.reviewCount,
      reviewResponseBand: "none",
    },
    softwareToolCountEstimate: undefined,
    now,
  });
  const outreachAngle = classifyCompanyOutreachAngle({
    presence: {
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: input.phone,
      hasClaimedGoogleBusinessProfile:
        input.googleRating != null || input.reviewCount != null,
      googleRating: input.googleRating,
      reviewCount: input.reviewCount,
      reviewResponseBand: "none",
    },
    segment,
    manualReviewRequired: enrichment.manualReviewRequired,
    now,
  });

  return {
    id: createEntityId("company") as Company["id"],
    name: input.companyName,
    industryKey: "independent_used_car_dealer",
    subindustry: input.subindustry,
    icpProfileId,
    status: "new",
    priorityTier: priorityTier.tier,
    isIndependent: true,
    location: {
      streetAddress: input.streetAddress,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
    },
    presence: {
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      primaryPhone: input.phone,
      hasClaimedGoogleBusinessProfile:
        input.googleRating != null || input.reviewCount != null,
      googleRating: input.googleRating,
      reviewCount: input.reviewCount,
      reviewResponseBand: "none",
    },
    buyingStage: "unknown",
    painSignals: buildPainSignals(
      input,
      normalizedWebsite,
      segment.label,
      outreachAngle.label,
    ),
    disqualifierSignals: [],
    notes: splitIntakeNotes(input.notes),
    recommendedOfferIds: prioritizeRecommendedOfferIds(
      outreachAngle.recommendedFirstOfferId,
      [],
    ),
    primaryContactId,
    activeCampaignIds: [],
    appointmentIds: [],
    scoring: {
      fitScore,
      offerFitScore: fitScore,
      outreachReadinessScore: input.contactEmail ? fitScore : clampScore(fitScore - 12),
      bucket: scoringBucket.key,
      reasons: buildScoringReasons(
        input,
        normalizedWebsite,
        fitScore,
        segment.label,
        outreachAngle.label,
      ),
    },
    enrichment: {
      ...enrichment,
      segment,
      outreachAngle,
    },
    source: buildSourceReference(input, now),
    createdAt: now,
    updatedAt: now,
  };
}

function buildInitialEnrichmentSnapshot(
  input: LeadIntakeInput,
  now: string,
) {
  const noteArtifacts = parseImportedNoteArtifacts(splitIntakeNotes(input.notes), now);
  const normalizedWebsite =
    normalizeWebsiteUrl(input.website) ?? noteArtifacts.suggestedWebsite;
  const websiteDiscovery = normalizedWebsite
    ? buildRecordProvidedDiscoverySnapshot({
        website: normalizedWebsite,
        now,
        source:
          noteArtifacts.suggestedWebsite && !normalizeWebsiteUrl(input.website)
            ? noteArtifacts.hints.find((hint) => hint.kind === "website")?.source ?? buildSourceReference(input, now)
            : buildSourceReference(input, now),
        matchedSignals: noteArtifacts.suggestedWebsite && !normalizeWebsiteUrl(input.website)
          ? ["Website surfaced from imported notes"]
          : ["Website was present on the imported lead record"],
      })
    : {
        status: "not_checked" as const,
        confirmationStatus: "not_found" as const,
        confirmationReason: "Website discovery has not run yet.",
        confidenceLevel: "none" as const,
        confidenceScore: 0,
        discoveredWebsite: undefined,
        candidateWebsite: undefined,
        candidateUrls: [],
        matchedSignals: [],
        supportingPageUrls: [],
        contactPageUrls: [],
        staffPageUrls: [],
        extractedEvidence: [],
        operatorReview: undefined,
        source: buildSourceReference(input, now),
        lastCheckedAt: now,
        lastError: undefined,
      };

  return {
    noteArtifacts,
    enrichment: {
      confidenceLevel: "none" as const,
      confidenceScore: 24,
      contactPath: "none" as const,
      enrichmentSource: "record_only" as const,
      sourceUrls: [],
      pagesChecked: [],
      foundEmails: noteArtifacts.hints
        .filter((hint) => hint.kind === "email")
        .map((hint) => hint.value),
      foundPhones: noteArtifacts.hints
        .filter((hint) => hint.kind === "phone")
        .map((hint) => hint.value),
      foundNames: noteArtifacts.hints
        .filter((hint) => hint.kind === "contact_name")
        .map((hint) => hint.value),
      websiteDiscovery,
      noteHints: noteArtifacts.hints,
      missingFields: dedupeStrings([
        !normalizedWebsite ? "website" : undefined,
        !input.phone && !noteArtifacts.suggestedPhone ? "phone" : undefined,
        !input.primaryContactName &&
        !noteArtifacts.hints.find((hint) => hint.kind === "contact_name")
          ? "named contact"
          : undefined,
        !input.subindustry ? "subindustry" : undefined,
      ]),
      manualReviewRequired: true,
      linkedinVerificationNeeded: false,
      linkedinVerified: false,
      lastAttemptedAt: now,
    } satisfies CompanyEnrichmentSnapshot,
  };
}

function buildContactRecord(params: {
  companyId: Company["id"];
  now: string;
  normalizedWebsite: string | undefined;
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  sourceKind: Contact["sourceKind"];
  source: Contact["source"];
  notes?: string[];
  forceNeedsReview?: boolean;
}): Contact {
  const qualityAssessment = assessContactPath({
    email: params.email,
    phone: params.phone,
    fullName: params.fullName,
    title: params.title,
    companyHost: getCompanyHost(params.normalizedWebsite),
    source: params.source,
    hasWebsiteEvidence: Boolean(params.normalizedWebsite),
  });
  const signals = [
    params.source.provider === "imported_notes"
      ? "Imported notes surfaced this contact path"
      : "Operator-entered during lead intake",
    params.title ? `Title captured: ${params.title}` : undefined,
    params.email ? "Direct contact email captured" : undefined,
  ].filter((value): value is string => Boolean(value));
  const status =
    params.forceNeedsReview && qualityAssessment.status === "verified"
      ? "candidate"
      : qualityAssessment.status;
  const quality = buildContactQualitySnapshot(qualityAssessment, params.now, {
    warnings: params.forceNeedsReview
      ? ["Imported notes should be verified before outreach"]
      : [],
  });

  const contact: Contact = {
    id: createEntityId("contact") as Contact["id"],
    companyId: params.companyId,
    fullName: params.fullName,
    title: params.title,
    role: deriveContactRoleFromTitle(params.title),
    email: params.email,
    phone: params.phone,
    sourceKind: params.sourceKind,
    status,
    isPrimary: true,
    outreachReady: params.forceNeedsReview ? false : quality.campaignEligible,
    confidence: {
      score: qualityAssessment.confidenceScore,
      signals: [...signals, ...qualityAssessment.selectionReasons],
    },
    quality,
    notes: params.notes ?? [],
    source: params.source,
    createdAt: params.now,
    updatedAt: params.now,
  };

  return contact;
}

function buildInitialContacts(params: {
  input: LeadIntakeInput;
  companyId: Company["id"];
  now: string;
  normalizedWebsite: string | undefined;
  noteArtifacts: ReturnType<typeof parseImportedNoteArtifacts>;
}) {
  const contacts: Contact[] = [];

  if (hasContactInput(params.input)) {
    contacts.push(
      buildContactRecord({
        companyId: params.companyId,
        now: params.now,
        normalizedWebsite: params.normalizedWebsite,
        fullName: params.input.primaryContactName,
        title: params.input.contactTitle,
        email: params.input.contactEmail,
        phone: params.input.phone,
        sourceKind: "observed",
        source: buildSourceReference(params.input, params.now),
      }),
    );
  }

  for (const candidate of params.noteArtifacts.candidateContacts) {
    contacts.push(
      buildContactRecord({
        companyId: params.companyId,
        now: params.now,
        normalizedWebsite: params.normalizedWebsite,
        fullName: candidate.fullName,
        title: candidate.title,
        email: candidate.email,
        phone: candidate.phone,
        sourceKind: "inferred",
        source: candidate.source,
        notes: candidate.notes,
        forceNeedsReview: candidate.requiresReview,
      }),
    );
  }

  const dedupedContacts = contacts.filter(
    (contact, index, collection) =>
      collection.findIndex(
        (current) =>
          current.email === contact.email &&
          current.phone === contact.phone &&
          current.fullName === contact.fullName &&
          current.title === contact.title,
      ) === index,
  );

  return applyPrimaryContactSelection({
    contacts: dedupedContacts,
    companyHost: params.normalizedWebsite
      ? new URL(params.normalizedWebsite).hostname.replace(/^www\./, "").toLowerCase()
      : undefined,
    now: params.now,
  });
}

function findDuplicateCompany(
  input: LeadIntakeInput,
  existingCompanies: readonly Company[],
): LeadDuplicateCheck {
  const normalizedName = normalizeCompanyNameForComparison(input.companyName);
  const normalizedWebsite = normalizeWebsiteUrl(input.website);

  return {
    companyNameMatch: existingCompanies.find(
      (company) =>
        normalizeCompanyNameForComparison(company.name) === normalizedName,
    ),
    websiteMatch: normalizedWebsite
      ? existingCompanies.find(
          (company) =>
            normalizeWebsiteUrl(company.presence.websiteUrl) === normalizedWebsite,
        )
      : undefined,
  };
}

function getDuplicateMessage(duplicateCheck: LeadDuplicateCheck) {
  if (duplicateCheck.companyNameMatch && duplicateCheck.websiteMatch) {
    return "A company with this name and website already exists.";
  }

  if (duplicateCheck.companyNameMatch) {
    return "A company with this name already exists.";
  }

  if (duplicateCheck.websiteMatch) {
    return "A company with this website already exists.";
  }

  return "Possible duplicate detected.";
}

export async function createLeadFromInput(
  input: LeadIntakeInput,
): Promise<CreateLeadOutcome> {
  const fieldErrors = validateLeadIntakeInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "validation_error",
      message: getLeadIntakeIssueMessages(fieldErrors)[0] ?? "Lead data is invalid.",
      fieldErrors,
    };
  }

  const dataAccess = getDataAccess();
  const now = new Date().toISOString();
  const initialSnapshot = buildInitialEnrichmentSnapshot(input, now);
  const resolvedInput: LeadIntakeInput = {
    ...input,
    website:
      normalizeWebsiteUrl(input.website) ??
      initialSnapshot.noteArtifacts.suggestedWebsite ??
      input.website,
    phone: input.phone ?? initialSnapshot.noteArtifacts.suggestedPhone,
  };
  const existingCompanies = await dataAccess.companies.list();
  const duplicateCheck = findDuplicateCompany(resolvedInput, existingCompanies);

  if (duplicateCheck.companyNameMatch || duplicateCheck.websiteMatch) {
    return {
      status: "duplicate",
      message: getDuplicateMessage(duplicateCheck),
      duplicateCheck,
    };
  }

  let createdCompany = await dataAccess.companies.create(
    buildCompanyRecord(resolvedInput, undefined, initialSnapshot.enrichment),
  );
  const createdContacts = buildInitialContacts({
    input: resolvedInput,
    companyId: createdCompany.id,
    now,
    normalizedWebsite:
      normalizeWebsiteUrl(resolvedInput.website) ??
      initialSnapshot.enrichment.websiteDiscovery?.discoveredWebsite,
    noteArtifacts: initialSnapshot.noteArtifacts,
  }).contacts;

  if (createdContacts.length > 0) {
    await Promise.all(
      createdContacts.map((contact) => dataAccess.contacts.create(contact)),
    );

    const primaryContact = createdContacts.find((contact) => contact.isPrimary);
    createdCompany = await dataAccess.companies.update({
      ...createdCompany,
      primaryContactId: primaryContact?.id,
      updatedAt: now,
    });
  }

  return {
    status: "success",
    message: `${createdCompany.name} was added to the intake queue.`,
    result: {
      company: createdCompany,
      contact: createdContacts.find((contact) => contact.isPrimary),
      contacts: createdContacts,
    },
  };
}

export async function importLeadRows(
  rows: ParsedLeadCsvRow[],
): Promise<LeadImportSummary> {
  const dataAccess = getDataAccess();
  const existingCompanies = [...(await dataAccess.companies.list())];
  const summary: LeadImportSummary = {
    createdCompanies: 0,
    createdContacts: 0,
    duplicateRows: 0,
    invalidRows: 0,
    createdCompanyIds: [],
    createdContactIds: [],
    notices: [],
  };

  for (const row of rows) {
    if (row.issues.length > 0) {
      summary.invalidRows += 1;
      if (summary.notices.length < 8) {
        summary.notices.push(
          `Row ${row.rowNumber} skipped: ${row.issues.join(" ")}`,
        );
      }
      continue;
    }

    const duplicateCheck = findDuplicateCompany(row.input, existingCompanies);
    if (duplicateCheck.companyNameMatch || duplicateCheck.websiteMatch) {
      summary.duplicateRows += 1;
      if (summary.notices.length < 8) {
        summary.notices.push(
          `Row ${row.rowNumber} skipped as a duplicate of ${duplicateCheck.companyNameMatch?.name ?? duplicateCheck.websiteMatch?.name ?? "an existing company"}.`,
        );
      }
      continue;
    }

    const outcome = await createLeadFromInput(row.input);
    if (outcome.status !== "success" || !outcome.result) {
      summary.invalidRows += 1;
      if (summary.notices.length < 8) {
        summary.notices.push(`Row ${row.rowNumber} failed: ${outcome.message}`);
      }
      continue;
    }

    summary.createdCompanies += 1;
    summary.createdCompanyIds.push(outcome.result.company.id);
    existingCompanies.push(outcome.result.company);

    if ((outcome.result.contacts?.length ?? 0) > 0) {
      summary.createdContacts += outcome.result.contacts?.length ?? 0;
      summary.createdContactIds.push(
        ...(outcome.result.contacts ?? []).map((contact) => contact.id),
      );
    }
  }

  return summary;
}
