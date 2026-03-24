import { getDataAccess } from "@/lib/data/access";
import { initialIcpProfiles } from "@/lib/data/config/icp";
import { initialOffers } from "@/lib/data/config/offers";
import { priorityTierDefinitions, scoringBuckets } from "@/lib/data/config/priority-tiers";
import type {
  Company,
  Contact,
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
const frontDoorOffer = initialOffers.find((offer) => offer.isPrimaryFrontDoor);

function createEntityId(prefix: "company" | "contact") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as
    | Company["id"]
    | Contact["id"];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
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

  if (painSignals.length === 0) {
    painSignals.push("New lead intake still needs enrichment and qualification");
  }

  return painSignals;
}

function buildScoringReasons(
  input: LeadIntakeInput,
  normalizedWebsite: string | undefined,
  fitScore: number,
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
): Company {
  const now = new Date().toISOString();
  const normalizedWebsite = normalizeWebsiteUrl(input.website);
  const fitScore = calculateInitialFitScore(input, normalizedWebsite);
  const scoringBucket = getScoreBucket(fitScore);
  const priorityTier = getPriorityTier(fitScore);
  const icpProfileId = deriveIcpProfileId(input, normalizedWebsite, fitScore);

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
      city: input.city,
      state: input.state,
      country: input.country,
    },
    presence: {
      hasWebsite: Boolean(normalizedWebsite),
      websiteUrl: normalizedWebsite,
      hasClaimedGoogleBusinessProfile:
        input.googleRating != null || input.reviewCount != null,
      googleRating: input.googleRating,
      reviewCount: input.reviewCount,
      reviewResponseBand: "none",
    },
    buyingStage: "unknown",
    painSignals: buildPainSignals(input, normalizedWebsite),
    disqualifierSignals: [],
    notes: splitIntakeNotes(input.notes),
    recommendedOfferIds: frontDoorOffer ? [frontDoorOffer.id] : [],
    primaryContactId,
    activeCampaignIds: [],
    appointmentIds: [],
    scoring: {
      fitScore,
      offerFitScore: fitScore,
      outreachReadinessScore: input.contactEmail ? fitScore : clampScore(fitScore - 12),
      bucket: scoringBucket.key,
      reasons: buildScoringReasons(input, normalizedWebsite, fitScore),
    },
    source: buildSourceReference(input, now),
    createdAt: now,
    updatedAt: now,
  };
}

function buildContactRecord(
  input: LeadIntakeInput,
  companyId: Company["id"],
): Contact {
  const now = new Date().toISOString();
  const signals = ["Operator-entered during lead intake"];

  if (input.contactTitle) {
    signals.push(`Title captured: ${input.contactTitle}`);
  }

  if (input.contactEmail) {
    signals.push("Direct contact email captured");
  }

  const confidenceScore = clampScore(
    input.contactEmail ? 84 : input.contactTitle ? 70 : 58,
  );

  return {
    id: createEntityId("contact") as Contact["id"],
    companyId,
    fullName: input.primaryContactName,
    title: input.contactTitle,
    role: deriveContactRoleFromTitle(input.contactTitle),
    email: input.contactEmail,
    sourceKind: "observed",
    status: input.contactEmail ? "verified" : "candidate",
    isPrimary: true,
    outreachReady: Boolean(input.contactEmail),
    confidence: {
      score: confidenceScore / 100,
      signals,
    },
    notes: [],
    source: buildSourceReference(input, now),
    createdAt: now,
    updatedAt: now,
  };
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
  const existingCompanies = await dataAccess.companies.list();
  const duplicateCheck = findDuplicateCompany(input, existingCompanies);

  if (duplicateCheck.companyNameMatch || duplicateCheck.websiteMatch) {
    return {
      status: "duplicate",
      message: getDuplicateMessage(duplicateCheck),
      duplicateCheck,
    };
  }

  const provisionalContact = hasContactInput(input)
    ? buildContactRecord(input, "company_placeholder" as Company["id"])
    : undefined;
  const company = buildCompanyRecord(input, undefined);
  const createdCompany = await dataAccess.companies.create(company);

  let createdContact: Contact | undefined;
  if (provisionalContact) {
    createdContact = await dataAccess.contacts.create({
      ...provisionalContact,
      companyId: createdCompany.id,
    });
  }

  return {
    status: "success",
    message: `${createdCompany.name} was added to the intake queue.`,
    result: {
      company: createdCompany,
      contact: createdContact,
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

    if (outcome.result.contact) {
      summary.createdContacts += 1;
      summary.createdContactIds.push(outcome.result.contact.id);
    }
  }

  return summary;
}
