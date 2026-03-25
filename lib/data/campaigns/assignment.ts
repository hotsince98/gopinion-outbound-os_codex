import { getDataAccess } from "@/lib/data/access";
import {
  applyPrimaryContactSelection,
  assessContactPath,
  buildContactQualitySnapshot,
  getCompanyHost,
  rankContactsForPrimarySelection,
} from "@/lib/data/contacts/quality";
import {
  deriveWorkflowState,
  getCompanyBundle,
  hasAnyContactPath,
  isContactCampaignEligible,
  type CompanyBundle,
} from "@/lib/data/company/workflow";
import {
  buildIdMap,
  getSelectorDataSnapshot,
  type SelectorDataSnapshot,
} from "@/lib/data/selectors/snapshot";
import type {
  Campaign,
  CampaignAssignmentRecommendation,
  CampaignEnrollmentDecision,
  CampaignEnrollmentMode,
  CampaignEnrollmentRunSummary,
  CampaignEnrollmentRecordResult,
  CampaignId,
  Company,
  CompanyId,
  Contact,
  ContactId,
  Enrollment,
  EnrollmentId,
  EnrichmentConfidenceLevel,
  Offer,
} from "@/lib/domain";

interface CampaignCandidateScore {
  campaign: Campaign;
  offer?: Offer;
  score: number;
  reasons: string[];
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function createContactId() {
  return `contact_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as ContactId;
}

function createEnrollmentId() {
  return `enrollment_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as EnrollmentId;
}

function getAngleLabel(company: Company) {
  return company.enrichment?.outreachAngle?.label ?? "Angle pending";
}

function getAngleReason(company: Company) {
  return (
    company.enrichment?.outreachAngle?.shortReason ??
    "Angle still needs campaign review before enrollment."
  );
}

function getConfidenceLevel(company: Company): EnrichmentConfidenceLevel {
  return (
    company.enrichment?.outreachAngle?.confidenceLevel ??
    company.enrichment?.confidenceLevel ??
    "none"
  );
}

function getPrimaryContactLabel(contact: Contact | undefined, company: Company) {
  if (contact) {
    return contact.fullName ?? contact.email ?? contact.phone ?? "Primary contact";
  }

  return (
    company.enrichment?.foundEmails[0] ??
    company.enrichment?.foundPhones[0] ??
    company.presence.primaryPhone ??
    "No contact path selected"
  );
}

function getPrimaryContactSource(contact: Contact | undefined) {
  if (!contact) {
    return "Source pending";
  }

  return `${contact.source.label ?? contact.source.provider} • ${contact.source.kind}`;
}

function getPrimaryContactQuality(contact: Contact | undefined) {
  if (!contact) {
    return "Quality pending";
  }

  switch (contact.quality?.qualityTier) {
    case "strong":
      return "Strong contact path";
    case "usable":
      return "Usable contact path";
    case "weak":
      return "Weak contact path";
    case "junk":
      return "Low-quality contact path";
    default:
      return `Confidence ${contact.confidence.score.toFixed(2)}`;
  }
}

function getNonTerminalEnrollment(
  enrollments: readonly Enrollment[],
  companyId: CompanyId,
  campaignId: CampaignId,
  contactId: ContactId,
) {
  return enrollments.find(
    (enrollment) =>
      enrollment.companyId === companyId &&
      enrollment.campaignId === campaignId &&
      enrollment.contactId === contactId &&
      enrollment.state !== "completed" &&
      enrollment.state !== "failed",
  );
}

function scoreCampaignForBundle(
  bundle: CompanyBundle,
  campaign: Campaign,
  offerById: Map<string, Offer>,
): CampaignCandidateScore {
  const recommendedOfferId =
    bundle.company.enrichment?.outreachAngle?.recommendedFirstOfferId ??
    bundle.company.recommendedOfferIds[0];
  const reasons: string[] = [];
  let score = 0;

  switch (campaign.status) {
    case "active":
      score += 40;
      reasons.push("Campaign is active and can take new enrollments now");
      break;
    case "paused":
      score += 14;
      reasons.push("Campaign is paused but still matches the account");
      break;
    case "draft":
      score += 10;
      reasons.push("Campaign exists but still needs campaign review");
      break;
    case "completed":
    case "archived":
      score -= 100;
      reasons.push("Campaign is no longer usable for new enrollments");
      break;
  }

  if (campaign.offerId === recommendedOfferId) {
    score += 34;
    reasons.push("Campaign offer matches the recommended first offer");
  } else if (bundle.company.recommendedOfferIds.includes(campaign.offerId)) {
    score += 18;
    reasons.push("Campaign still matches a secondary recommended offer");
  }

  if (campaign.targetTier === bundle.company.priorityTier) {
    score += 16;
    reasons.push("Campaign target tier matches the lead priority tier");
  } else if (
    bundle.company.priorityTier === "tier_1" &&
    campaign.targetTier === "tier_2"
  ) {
    score += 6;
    reasons.push("Tier 2 campaign can still cover the account if needed");
  }

  if (campaign.primaryIcpProfileId === bundle.company.icpProfileId) {
    score += 14;
    reasons.push("Campaign ICP matches the company ICP profile");
  }

  if (bundle.company.activeCampaignIds.includes(campaign.id)) {
    score += 20;
    reasons.push("Company is already attached to this campaign");
  }

  if (
    bundle.company.enrichment?.outreachAngle?.reviewPath === "campaign_review" &&
    campaign.status === "draft"
  ) {
    score += 4;
    reasons.push("Draft campaign still fits the current angle-review path");
  }

  return {
    campaign,
    offer: offerById.get(campaign.offerId),
    score,
    reasons,
  };
}

function getAvailableCampaigns(snapshot: SelectorDataSnapshot) {
  return snapshot.campaigns.filter(
    (campaign) => campaign.status !== "completed" && campaign.status !== "archived",
  );
}

function getRecommendedCampaign(
  bundle: CompanyBundle,
  snapshot: SelectorDataSnapshot,
) {
  const offerById = buildIdMap(snapshot.offers);

  return getAvailableCampaigns(snapshot)
    .map((campaign) => scoreCampaignForBundle(bundle, campaign, offerById))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.campaign.name.localeCompare(right.campaign.name);
    })[0];
}

function getSelectedCampaign(
  snapshot: SelectorDataSnapshot,
  campaignId: CampaignId | undefined,
) {
  if (!campaignId) {
    return undefined;
  }

  return snapshot.campaigns.find((campaign) => campaign.id === campaignId);
}

function getDecisionForBundle(params: {
  bundle: CompanyBundle;
  targetCampaign?: Campaign;
  targetOffer?: Offer;
}): {
  decision: CampaignEnrollmentDecision;
  decisionReason: string;
  blockedReason?: string;
  manualReviewRequired: boolean;
  campaignReviewRequired: boolean;
} {
  const { bundle, targetCampaign } = params;
  const workflowState = deriveWorkflowState(bundle);
  const primaryContact = bundle.primaryContact;
  const hasContactPath = hasAnyContactPath(bundle);
  const hasEmailPath = Boolean(primaryContact?.email);
  const contactQualityTier = primaryContact?.quality?.qualityTier;
  const pathKind = primaryContact?.quality?.pathKind;
  const manualReviewRequired =
    workflowState === "needs_review" ||
    bundle.company.enrichment?.manualReviewRequired === true ||
    !primaryContact ||
    contactQualityTier === "weak" ||
    contactQualityTier === "junk" ||
    primaryContact?.status === "candidate" ||
    pathKind === "phone_only";
  const campaignReviewRequired =
    bundle.company.enrichment?.outreachAngle?.reviewPath === "campaign_review" ||
    Boolean(targetCampaign && targetCampaign.status !== "active");

  if (workflowState === "blocked") {
    return {
      decision: "blocked",
      decisionReason:
        "Lead is still blocked because no usable website, phone, or contact path is verified.",
      blockedReason:
        bundle.company.disqualifierSignals[0] ??
        "Still blocked because no usable website, phone, or contact path is verified.",
      manualReviewRequired,
      campaignReviewRequired,
    };
  }

  if (!targetCampaign) {
    return {
      decision: "blocked",
      decisionReason:
        "No matching campaign is available for the current offer and readiness profile.",
      blockedReason:
        "No active, paused, or draft campaign matches this lead well enough yet.",
      manualReviewRequired,
      campaignReviewRequired: true,
    };
  }

  if (!hasContactPath) {
    return {
      decision: "blocked",
      decisionReason: "Lead has no usable contact path to assign into outreach yet.",
      blockedReason: "No usable email or phone path is stored on the record yet.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (!primaryContact) {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        "A contact path exists, but a single primary outreach contact still needs to be selected.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (contactQualityTier === "junk") {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        primaryContact.quality?.warnings[0] ??
        "The best available contact still looks system-generated or low quality.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (contactQualityTier === "weak") {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        primaryContact.quality?.warnings[0] ??
        "The best contact path is still weak and should be reviewed before enrollment.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (pathKind === "phone_only") {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        "A phone fallback exists, but the current email campaign needs a usable email path first.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (!isContactCampaignEligible(primaryContact)) {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        primaryContact.quality?.warnings[0] ??
        "The primary contact still needs quality review before enrollment.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (!hasEmailPath) {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        "The current campaign flow still needs a usable email path before enrollment.",
      manualReviewRequired: true,
      campaignReviewRequired,
    };
  }

  if (campaignReviewRequired) {
    return {
      decision: "review_before_enrollment",
      decisionReason:
        targetCampaign.status !== "active"
          ? `${targetCampaign.name} is ${formatLabel(targetCampaign.status).toLowerCase()}, so it should be reviewed before enrollment.`
          : "This lead should go through campaign review before direct enrollment.",
      manualReviewRequired,
      campaignReviewRequired,
    };
  }

  if (primaryContact.quality?.pathKind === "role_inbox") {
    return {
      decision: "enroll_now",
      decisionReason:
        "Ready to enroll now using an exact-domain role inbox, with slightly lower confidence than a named contact.",
      manualReviewRequired: false,
      campaignReviewRequired: false,
    };
  }

  if (primaryContact.fullName) {
    return {
      decision: "enroll_now",
      decisionReason:
        "Ready to enroll now because a named company-domain contact is selected.",
      manualReviewRequired: false,
      campaignReviewRequired: false,
    };
  }

  return {
    decision: "enroll_now",
    decisionReason:
      "Ready to enroll now because a usable exact-domain business email is selected.",
    manualReviewRequired: false,
    campaignReviewRequired: false,
  };
}

function buildFallbackContact(company: Company, now: string) {
  const email = company.enrichment?.foundEmails[0];
  const phone =
    company.enrichment?.foundPhones[0] ?? company.presence.primaryPhone;

  if (!email && !phone) {
    return undefined;
  }

  const website =
    company.presence.websiteUrl ??
    company.enrichment?.websiteDiscovery?.discoveredWebsite;
  const source = {
    kind: "system_inference" as const,
    provider: "campaign_assignment",
    label: "Campaign assignment fallback",
    url: website,
    observedAt: now,
  };
  const assessment = assessContactPath({
    email,
    phone,
    companyHost: getCompanyHost(website),
    source,
    hasWebsiteEvidence: Boolean(website),
  });

  return {
    id: createContactId(),
    companyId: company.id,
    fullName: undefined,
    title: email ? "Main business inbox" : "Main line",
    role: "unknown" as const,
    email,
    phone,
    linkedinUrl: undefined,
    sourceKind: email ? ("observed" as const) : ("inferred" as const),
    status: assessment.status,
    isPrimary: false,
    outreachReady: assessment.campaignEligible,
    confidence: {
      score: assessment.confidenceScore,
      signals: dedupeStrings([
        ...assessment.selectionReasons,
        email
          ? "Fallback contact was created from discovered business email evidence"
          : "Fallback contact was created from the stored business phone path",
      ]),
    },
    quality: buildContactQualitySnapshot(assessment, now, {
      selectionReasons: [
        "Campaign assignment preserved an otherwise-usable fallback contact path",
      ],
    }),
    notes: [
      email
        ? `Campaign assignment created a fallback inbox record for ${email}.`
        : `Campaign assignment created a fallback phone record for ${phone}.`,
    ],
    source,
    createdAt: now,
    updatedAt: now,
  } satisfies Contact;
}

async function ensurePrimaryContactContext(
  bundle: CompanyBundle,
  now: string,
): Promise<CompanyBundle> {
  const dataAccess = getDataAccess();
  const existingContactIds = new Set(bundle.contacts.map((contact) => contact.id));
  const fallbackContact = buildFallbackContact(bundle.company, now);
  const contacts: Contact[] =
    bundle.contacts.length > 0
      ? [...bundle.contacts]
      : fallbackContact
        ? [fallbackContact]
        : [];

  if (contacts.length === 0) {
    return bundle;
  }

  const applied = applyPrimaryContactSelection({
    contacts,
    preferredContactId: bundle.company.primaryContactId,
    now,
  });

  for (const contact of applied.contacts) {
    if (existingContactIds.has(contact.id)) {
      await dataAccess.contacts.update(contact);
    } else {
      await dataAccess.contacts.create(contact);
    }
  }

  let company = bundle.company;

  if (company.primaryContactId !== applied.primaryContact?.id) {
    company = await dataAccess.companies.update({
      ...company,
      primaryContactId: applied.primaryContact?.id,
      updatedAt: now,
    });
  }

  const rankedContacts = rankContactsForPrimarySelection(applied.contacts, {
    preferredContactId: company.primaryContactId,
  });

  return {
    ...bundle,
    company,
    contacts: rankedContacts.map((selection) => selection.contact),
    rankedContacts,
    primaryContact:
      rankedContacts.find((selection) => selection.isPrimary)?.contact ??
      applied.primaryContact,
  };
}

function buildRecommendation(params: {
  bundle: CompanyBundle;
  snapshot: SelectorDataSnapshot;
  selectedCampaignId?: CampaignId;
}): CampaignAssignmentRecommendation {
  const scoredCampaign = params.selectedCampaignId
    ? (() => {
        const selectedCampaign = getSelectedCampaign(
          params.snapshot,
          params.selectedCampaignId,
        );

        if (!selectedCampaign) {
          return undefined;
        }

        return scoreCampaignForBundle(
          params.bundle,
          selectedCampaign,
          buildIdMap(params.snapshot.offers),
        );
      })()
    : getRecommendedCampaign(params.bundle, params.snapshot);
  const targetCampaign = scoredCampaign?.campaign;
  const offer = scoredCampaign?.offer;
  const primaryContact = params.bundle.primaryContact;
  const decision = getDecisionForBundle({
    bundle: params.bundle,
    targetCampaign,
    targetOffer: offer,
  });

  return {
    companyId: params.bundle.company.id,
    decision: decision.decision,
    decisionReason: decision.decisionReason,
    blockedReason: decision.blockedReason,
    manualReviewRequired: decision.manualReviewRequired,
    campaignReviewRequired: decision.campaignReviewRequired,
    confidenceLevel: getConfidenceLevel(params.bundle.company),
    recommendedCampaignId: targetCampaign?.id,
    recommendedCampaignName: targetCampaign?.name,
    recommendedCampaignStatus: targetCampaign?.status,
    recommendedOfferId: offer?.id ?? params.bundle.recommendedOffer?.id,
    recommendedOfferName: offer?.name ?? params.bundle.recommendedOffer?.name,
    recommendedSequenceId: targetCampaign?.sequenceId,
    primaryContactId: primaryContact?.id,
    primaryContactLabel: getPrimaryContactLabel(primaryContact, params.bundle.company),
    primaryContactSource: getPrimaryContactSource(primaryContact),
    primaryContactQuality: getPrimaryContactQuality(primaryContact),
    primaryContactWarnings: primaryContact?.quality?.warnings ?? [],
    contactPathKind: primaryContact?.quality?.pathKind,
    contactQualityTier: primaryContact?.quality?.qualityTier,
    contactCampaignEligible: isContactCampaignEligible(primaryContact),
    angleLabel: getAngleLabel(params.bundle.company),
    angleReason: getAngleReason(params.bundle.company),
  };
}

function getUpdatedCompanyStatus(params: {
  company: Company;
  decision: CampaignEnrollmentDecision;
  mode: CampaignEnrollmentMode;
}) {
  if (params.company.status === "customer" || params.company.status === "disqualified") {
    return params.company.status;
  }

  if (params.decision === "enroll_now") {
    return "campaign_ready" as const;
  }

  if (params.mode === "assign" || params.decision === "review_before_enrollment") {
    return params.company.status === "new" || params.company.status === "enriched"
      ? ("qualified" as const)
      : params.company.status;
  }

  return params.company.status;
}

async function applyCampaignAssignment(params: {
  bundle: CompanyBundle;
  recommendation: CampaignAssignmentRecommendation;
  mode: CampaignEnrollmentMode;
  now: string;
  selectedCampaignId?: CampaignId;
  snapshot: SelectorDataSnapshot;
}): Promise<CampaignEnrollmentRecordResult> {
  const dataAccess = getDataAccess();
  const targetCampaignId =
    params.selectedCampaignId ?? params.recommendation.recommendedCampaignId;

  if (!targetCampaignId || !params.recommendation.recommendedCampaignName) {
    return {
      companyId: params.bundle.company.id,
      companyName: params.bundle.company.name,
      status: "blocked",
      message:
        params.recommendation.blockedReason ??
        "No matching campaign is available yet.",
      decision: params.recommendation.decision,
      warnings: params.recommendation.primaryContactWarnings,
      primaryContactLabel: params.recommendation.primaryContactLabel,
      primaryContactSource: params.recommendation.primaryContactSource,
      primaryContactQuality: params.recommendation.primaryContactQuality,
    };
  }

  if (params.recommendation.decision === "blocked") {
    return {
      companyId: params.bundle.company.id,
      companyName: params.bundle.company.name,
      status: "blocked",
      message:
        params.recommendation.blockedReason ??
        params.recommendation.decisionReason,
      decision: params.recommendation.decision,
      campaignId: targetCampaignId,
      campaignName: params.recommendation.recommendedCampaignName,
      warnings: params.recommendation.primaryContactWarnings,
      primaryContactLabel: params.recommendation.primaryContactLabel,
      primaryContactSource: params.recommendation.primaryContactSource,
      primaryContactQuality: params.recommendation.primaryContactQuality,
    };
  }

  const company = await dataAccess.companies.update({
    ...params.bundle.company,
    activeCampaignIds: dedupeStrings([
      ...params.bundle.company.activeCampaignIds,
      targetCampaignId,
    ]) as CampaignId[],
    status: getUpdatedCompanyStatus({
      company: params.bundle.company,
      decision: params.recommendation.decision,
      mode: params.mode,
    }),
    updatedAt: params.now,
  });

  if (params.mode === "assign" || params.recommendation.decision === "review_before_enrollment") {
    return {
      companyId: company.id,
      companyName: company.name,
      status:
        params.recommendation.decision === "review_before_enrollment"
          ? "review"
          : "assigned",
      message:
        params.recommendation.decision === "review_before_enrollment"
          ? `Assigned ${company.name} to ${params.recommendation.recommendedCampaignName} for review before enrollment.`
          : `Assigned ${company.name} to ${params.recommendation.recommendedCampaignName}.`,
      decision: params.recommendation.decision,
      campaignId: targetCampaignId,
      campaignName: params.recommendation.recommendedCampaignName,
      warnings: params.recommendation.primaryContactWarnings,
      primaryContactLabel: params.recommendation.primaryContactLabel,
      primaryContactSource: params.recommendation.primaryContactSource,
      primaryContactQuality: params.recommendation.primaryContactQuality,
    };
  }

  const primaryContactId = params.recommendation.primaryContactId;

  if (!primaryContactId) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "review",
      message:
        "Campaign was assigned, but enrollment still needs a single primary contact.",
      decision: "review_before_enrollment",
      campaignId: targetCampaignId,
      campaignName: params.recommendation.recommendedCampaignName,
      warnings: params.recommendation.primaryContactWarnings,
      primaryContactLabel: params.recommendation.primaryContactLabel,
      primaryContactSource: params.recommendation.primaryContactSource,
      primaryContactQuality: params.recommendation.primaryContactQuality,
    };
  }

  const existingEnrollment = getNonTerminalEnrollment(
    params.snapshot.enrollments,
    company.id,
    targetCampaignId,
    primaryContactId,
  );

  if (existingEnrollment) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "enrolled",
      message: `${company.name} is already enrolled in ${params.recommendation.recommendedCampaignName}.`,
      decision: "enroll_now",
      campaignId: targetCampaignId,
      campaignName: params.recommendation.recommendedCampaignName,
      enrollmentId: existingEnrollment.id,
      warnings: params.recommendation.primaryContactWarnings,
      primaryContactLabel: params.recommendation.primaryContactLabel,
      primaryContactSource: params.recommendation.primaryContactSource,
      primaryContactQuality: params.recommendation.primaryContactQuality,
    };
  }

  const enrollment: Enrollment = {
    id: createEnrollmentId(),
    companyId: company.id,
    contactId: primaryContactId,
    campaignId: targetCampaignId,
    sequenceId: params.recommendation.recommendedSequenceId ?? "sequence_reviews_tier_1_v2",
    offerId:
      params.recommendation.recommendedOfferId ??
      params.bundle.company.recommendedOfferIds[0] ??
      "offer_reviews_reputation",
    priorityTier: company.priorityTier,
    state: "pending",
    currentStepIndex: 0,
    enteredSequenceAt: params.now,
    nextActionAt: params.now,
    createdAt: params.now,
    updatedAt: params.now,
  };

  const createdEnrollment = await dataAccess.enrollments.create(enrollment);

  return {
    companyId: company.id,
    companyName: company.name,
    status: "enrolled",
    message: `Enrolled ${company.name} into ${params.recommendation.recommendedCampaignName}.`,
    decision: "enroll_now",
    campaignId: targetCampaignId,
    campaignName: params.recommendation.recommendedCampaignName,
    enrollmentId: createdEnrollment.id,
    warnings: params.recommendation.primaryContactWarnings,
    primaryContactLabel: params.recommendation.primaryContactLabel,
    primaryContactSource: params.recommendation.primaryContactSource,
    primaryContactQuality: params.recommendation.primaryContactQuality,
  };
}

export function buildCampaignAssignmentRecommendation(params: {
  bundle: CompanyBundle;
  snapshot: SelectorDataSnapshot;
  selectedCampaignId?: CampaignId;
}): CampaignAssignmentRecommendation {
  return buildRecommendation(params);
}

export async function runCampaignEnrollment(params: {
  companyIds: CompanyId[];
  mode: CampaignEnrollmentMode;
  campaignId?: CampaignId;
}): Promise<CampaignEnrollmentRunSummary> {
  const now = new Date().toISOString();
  const snapshot = await getSelectorDataSnapshot();
  const companyById = buildIdMap(snapshot.companies);
  const uniqueCompanyIds = Array.from(new Set(params.companyIds));
  const results: CampaignEnrollmentRecordResult[] = [];

  for (const companyId of uniqueCompanyIds) {
    const company = companyById.get(companyId);

    if (!company) {
      results.push({
        companyId,
        companyName: companyId,
        status: "failed",
        message: "The company could not be found in the current workspace snapshot.",
        decision: "blocked",
        warnings: [],
      });
      continue;
    }

    try {
      let bundle = getCompanyBundle(company, snapshot);
      bundle = await ensurePrimaryContactContext(bundle, now);

      const recommendation = buildRecommendation({
        bundle,
        snapshot,
        selectedCampaignId: params.campaignId,
      });
      const result = await applyCampaignAssignment({
        bundle,
        recommendation,
        mode: params.mode,
        now,
        selectedCampaignId: params.campaignId,
        snapshot,
      });

      results.push(result);
    } catch (error) {
      results.push({
        companyId: company.id,
        companyName: company.name,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Campaign assignment failed unexpectedly.",
        decision: "blocked",
        warnings: [],
      });
    }
  }

  return {
    requestedCount: uniqueCompanyIds.length,
    assignedCount: results.filter(
      (result) => result.status === "assigned" || result.status === "review",
    ).length,
    enrolledCount: results.filter((result) => result.status === "enrolled").length,
    reviewCount: results.filter((result) => result.status === "review").length,
    blockedCount: results.filter((result) => result.status === "blocked").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    mode: params.mode,
    processedAt: now,
    results,
  };
}
