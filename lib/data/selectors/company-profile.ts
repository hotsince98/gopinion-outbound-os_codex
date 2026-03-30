import { buildCampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";
import {
  deriveWorkflowState,
  getCampaignStatusLabel,
  getCompanyStatusBadge,
  getContactOrganizationBadgeForCompany,
  getContactQualityBadge,
  getContactSourceLabel,
  getContactWarnings,
  getDecisionMakerLabel,
  getEnrichmentProviderBadge,
  getEnrichmentProviderEvidenceLabel,
  getEnrichmentProviderFallbackLabel,
  getEnrichmentProviderLabel,
  getIcpLabel,
  getImportDateLabel,
  getIndustryLabel,
  getLastEnrichedLabel,
  getLatestReviewSignal,
  getNoteHintSummary,
  getOutreachAngleConfidenceBadge,
  getOutreachAngleLabel,
  getOutreachAngleReason,
  getOutreachAngleReviewPathBadge,
  getOutreachAngleUrgencyBadge,
  getPriorityBadge,
  getPreferredSupportingPage,
  getPreferredSupportingPageLabel,
  getPreferredSupportingPageSourceLabel,
  getPrimaryContactReadinessReason,
  getPrimaryContactSelectionReason,
  getRankedContactCountLabel,
  getRankedContactPreviews,
  getReadinessConfidenceBadge,
  getRecommendedOfferName,
  getReviewSnapshot,
  getSegmentLabel,
  getSourceLabel,
  getSuggestedNextAction,
  getSupportingPageUsageLabel,
  getWebsiteDiscoveryCandidateDiagnostics,
  getWebsiteDiscoveryCandidateLabel,
  getWebsiteDiscoveryConfidenceBadge,
  getWebsiteDiscoveryConfirmationBadge,
  getWebsiteDiscoveryLabel,
  getWebsiteDiscoveryReason,
  getWebsiteDiscoveryReviewedAtLabel,
  getWebsiteDiscoveryReviewSourceLabel,
  getWebsiteDiscoverySourceLabel,
  getWorkflowBadge,
  getWorkflowReason,
  type CompanyBundle,
  type RankedContactPreview,
  type SelectorBadge,
} from "@/lib/data/selectors/shared";
import type { SelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export interface CompanyContactDetail {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  confidence: string;
  status: string;
  source: string;
  organizationBadge: SelectorBadge;
  isPrimary: boolean;
  selectionLabel: string;
  selectionScore: string;
  selectionReasons: string[];
  demotionReasons: string[];
  quality: string;
  campaignEligibility: string;
  warnings: string[];
  readinessReason?: string;
  notes: string[];
}

export interface CompanyDetailView {
  companyId: string;
  companyName: string;
  market: string;
  subindustry: string;
  icpLabel: string;
  reviewSnapshot: string;
  latestReview: {
    badge: SelectorBadge;
    summary: string;
    snippet?: string;
    metaLabel: string;
  };
  priorityBadge: SelectorBadge;
  statusBadge: SelectorBadge;
  readinessBadge: SelectorBadge;
  suggestedNextAction: string;
  basics: Array<{ label: string; value: string }>;
  reputation: Array<{ label: string; value: string }>;
  pains: string[];
  notes: string[];
  outreachAngle: {
    label: string;
    reason: string;
    urgencyBadge: SelectorBadge;
    confidenceBadge: SelectorBadge;
    reviewPathBadge: SelectorBadge;
    segmentLabel: string;
  };
  recommendedOffer: {
    name: string;
    description: string;
    angle: string;
    cta: string;
  };
  confidenceBreakdown: Array<{ label: string; value: string }>;
  readinessConfidenceBadge: SelectorBadge;
  websiteDiscovery: {
    label: string;
    candidate: string;
    candidateUrl?: string;
    officialWebsite?: string;
    canReviewCandidate: boolean;
    reason: string;
    candidateDiagnostics: string[];
    sourceLabel: string;
    reviewSourceLabel?: string;
    reviewedAtLabel?: string;
    confirmationBadge: SelectorBadge;
    confidenceBadge: SelectorBadge;
  };
  providerTransparency: {
    badge: SelectorBadge;
    label: string;
    fallback: string;
    evidence: string;
    pageUsage: string;
  };
  preferredSupportingPage: {
    url?: string;
    label: string;
    sourceLabel: string;
    reason?: string;
  };
  topRecommendedContact: {
    label: string;
    reason: string;
    qualityBadge: SelectorBadge;
  };
  contactSummary: {
    totalLabel: string;
    highlights: RankedContactPreview[];
  };
  contacts: CompanyContactDetail[];
  campaignSummary: string[];
  campaignAssignment: ReturnType<typeof buildCampaignAssignmentPanelView>;
}

export function buildCompanyDetailView(params: {
  bundle: CompanyBundle;
  snapshot: SelectorDataSnapshot;
}): CompanyDetailView {
  const { bundle, snapshot } = params;
  const selectedCampaignAssignment = buildCampaignAssignmentPanelView({
    bundles: [bundle],
    snapshot,
  });

  return {
    companyId: bundle.company.id,
    companyName: bundle.company.name,
    market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
    subindustry: getIndustryLabel(bundle.company),
    icpLabel: getIcpLabel(bundle.company),
    reviewSnapshot: getReviewSnapshot(bundle.company),
    latestReview: getLatestReviewSignal(bundle.company),
    priorityBadge: getPriorityBadge(bundle.company.priorityTier),
    statusBadge: getCompanyStatusBadge(bundle.company.status),
    readinessBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
    suggestedNextAction: getSuggestedNextAction(bundle),
    basics: [
      {
        label: "Market",
        value: `${bundle.company.location.city}, ${bundle.company.location.state}`,
      },
      {
        label: "ICP profile",
        value: getIcpLabel(bundle.company),
      },
      {
        label: "Monthly cars",
        value: bundle.company.monthlyCarsSoldRange
          ? `${bundle.company.monthlyCarsSoldRange.min ?? "?"}-${bundle.company.monthlyCarsSoldRange.max ?? "?"} / month`
          : "Unknown",
      },
      {
        label: "Buying stage",
        value: bundle.company.buyingStage.replaceAll("_", " "),
      },
      {
        label: "Tool count",
        value: bundle.company.softwareToolCountEstimate
          ? `${bundle.company.softwareToolCountEstimate} tools`
          : "Unknown",
      },
      {
        label: "Source",
        value: getSourceLabel(bundle.company),
      },
      {
        label: "Imported",
        value: getImportDateLabel(bundle.company),
      },
      {
        label: "Last enrichment",
        value: getLastEnrichedLabel(bundle.company),
      },
      {
        label: "Discovery",
        value: getWebsiteDiscoveryLabel(bundle.company),
      },
      {
        label: "Segment",
        value: getSegmentLabel(bundle.company),
      },
      {
        label: "Workflow",
        value: getWorkflowReason(bundle),
      },
    ],
    reputation: [
      {
        label: "Rating",
        value:
          bundle.company.presence.googleRating != null
            ? `${bundle.company.presence.googleRating.toFixed(1)} stars`
            : "Unknown",
      },
      {
        label: "Review count",
        value:
          bundle.company.presence.reviewCount != null
            ? `${bundle.company.presence.reviewCount} reviews`
            : "Unknown",
      },
      {
        label: "Response pattern",
        value: bundle.company.presence.reviewResponseBand.replaceAll("_", " "),
      },
      {
        label: "Website + GBP",
        value: `${bundle.company.presence.hasWebsite ? "Website" : "No website"} • ${
          bundle.company.presence.hasClaimedGoogleBusinessProfile
            ? "Claimed GBP"
            : "No GBP"
        }`,
      },
      {
        label: "Parsed note hints",
        value: getNoteHintSummary(bundle.company),
      },
    ],
    pains: bundle.company.painSignals,
    notes: [
      ...(bundle.company.notes ?? []),
      ...bundle.company.scoring.reasons,
      ...(bundle.primaryContact?.notes ?? []),
    ],
    outreachAngle: {
      label: getOutreachAngleLabel(bundle.company),
      reason: getOutreachAngleReason(bundle.company),
      urgencyBadge: getOutreachAngleUrgencyBadge(bundle.company),
      confidenceBadge: getOutreachAngleConfidenceBadge(bundle.company),
      reviewPathBadge: getOutreachAngleReviewPathBadge(bundle.company),
      segmentLabel: getSegmentLabel(bundle.company),
    },
    recommendedOffer: {
      name: bundle.recommendedOffer?.name ?? "Offer pending",
      description:
        bundle.recommendedOffer?.description ?? "No offer has been assigned yet.",
      angle:
        bundle.recommendedOffer?.firstOutreachAngle ??
        "Offer angle is still pending.",
      cta: bundle.recommendedOffer?.primaryCta ?? "CTA is still pending.",
    },
    confidenceBreakdown: [
      {
        label: "Website discovery confidence",
        value: getWebsiteDiscoveryConfidenceBadge(bundle.company).label,
      },
      {
        label: "Primary contact quality",
        value: getContactQualityBadge(bundle.primaryContact).label,
      },
      {
        label: "Outreach-angle confidence",
        value: getOutreachAngleConfidenceBadge(bundle.company).label,
      },
      {
        label: "Overall readiness confidence",
        value: getReadinessConfidenceBadge(bundle.company).label,
      },
    ],
    readinessConfidenceBadge: getReadinessConfidenceBadge(bundle.company),
    websiteDiscovery: {
      label: getWebsiteDiscoveryLabel(bundle.company),
      candidate: getWebsiteDiscoveryCandidateLabel(bundle.company),
      candidateUrl: bundle.company.enrichment?.websiteDiscovery?.candidateWebsite,
      officialWebsite:
        bundle.company.presence.websiteUrl ??
        bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
      canReviewCandidate:
        bundle.company.enrichment?.websiteDiscovery?.confirmationStatus ===
        "needs_review",
      reason: getWebsiteDiscoveryReason(bundle.company),
      candidateDiagnostics: getWebsiteDiscoveryCandidateDiagnostics(bundle.company),
      sourceLabel: getWebsiteDiscoverySourceLabel(bundle.company),
      reviewSourceLabel: getWebsiteDiscoveryReviewSourceLabel(bundle.company),
      reviewedAtLabel: getWebsiteDiscoveryReviewedAtLabel(bundle.company),
      confirmationBadge: getWebsiteDiscoveryConfirmationBadge(bundle.company),
      confidenceBadge: getWebsiteDiscoveryConfidenceBadge(bundle.company),
    },
    providerTransparency: {
      badge: getEnrichmentProviderBadge(bundle.company),
      label: getEnrichmentProviderLabel(bundle.company),
      fallback: getEnrichmentProviderFallbackLabel(bundle.company),
      evidence: getEnrichmentProviderEvidenceLabel(bundle.company),
      pageUsage: getSupportingPageUsageLabel(bundle.company),
    },
    preferredSupportingPage: {
      url: getPreferredSupportingPage(bundle.company)?.url,
      label: getPreferredSupportingPageLabel(bundle.company),
      sourceLabel: getPreferredSupportingPageSourceLabel(bundle.company),
      reason: getPreferredSupportingPage(bundle.company)?.reason,
    },
    topRecommendedContact: {
      label: getDecisionMakerLabel(bundle),
      reason: getPrimaryContactSelectionReason(bundle),
      qualityBadge: getContactQualityBadge(bundle.primaryContact),
    },
    contactSummary: {
      totalLabel: getRankedContactCountLabel(bundle),
      highlights: getRankedContactPreviews(bundle, 4),
    },
    contacts: bundle.rankedContacts.map((selection) => {
      const contact = selection.contact;

      return {
        id: contact.id,
        name: contact.fullName ?? "Unnamed contact",
        role: contact.title ?? contact.role.replaceAll("_", " "),
        email: contact.email,
        phone: contact.phone,
        confidence: `Contact confidence ${contact.confidence.score.toFixed(2)}`,
        status: contact.status.replaceAll("_", " "),
        source: getContactSourceLabel(contact),
        organizationBadge: getContactOrganizationBadgeForCompany(
          bundle.company,
          contact,
        ),
        isPrimary: selection.isPrimary,
        selectionLabel: selection.isPrimary
          ? `Primary • Rank #${selection.selectionRank}`
          : selection.selectionRank === 2
            ? `Secondary • Rank #${selection.selectionRank}`
            : `Backup • Rank #${selection.selectionRank}`,
        selectionScore: `Selection score ${selection.selectionScore}`,
        selectionReasons: selection.selectionReasons.slice(0, 2),
        demotionReasons: selection.demotionReasons.slice(0, 2),
        quality:
          contact.quality?.qualityTier.replaceAll("_", " ") ??
          `Confidence ${contact.confidence.score.toFixed(2)}`,
        campaignEligibility: contact.quality?.campaignEligible
          ? "Campaign-eligible"
          : "Needs review",
        warnings: getContactWarnings(contact),
        readinessReason: selection.isPrimary
          ? getPrimaryContactReadinessReason(bundle)
          : undefined,
        notes: contact.notes,
      };
    }),
    campaignSummary:
      bundle.activeCampaigns.length > 0
        ? bundle.activeCampaigns.map(
            (campaign) => `${campaign.name} • ${campaign.status} • ${campaign.objective}`,
          )
        : ["No active campaign is attached to this company yet."],
    campaignAssignment: selectedCampaignAssignment,
  };
}
