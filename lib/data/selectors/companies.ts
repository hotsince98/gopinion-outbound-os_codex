import { buildCampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";
import {
  cleanQuery,
  deriveWorkflowState,
  getCampaignStatusLabel,
  getCompanyStatusBadge,
  getContactCoverageLabel,
  getContactOrganizationBadgeForCompany,
  getContactQualityBadge,
  getContactSourceLabel,
  getContactWarnings,
  getDecisionMakerConfidenceLabel,
  getDecisionMakerLabel,
  getEnrichmentProviderBadge,
  getEnrichmentProviderEvidenceLabel,
  getEnrichmentProviderFallbackLabel,
  getEnrichmentProviderLabel,
  getIcpFilterOptions,
  getIcpLabel,
  getImportDateLabel,
  getIndustryLabel,
  getLastEnrichedLabel,
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
  getPrimaryContactSelectionReason,
  getPrimaryContactReadinessReason,
  getRankedContactCountLabel,
  getRankedContactPreviews,
  getReadinessConfidenceBadge,
  getRecommendedOfferName,
  getReviewSnapshot,
  getSegmentLabel,
  getSourceLabel,
  getSuggestedNextAction,
  getSupportingPageUsageLabel,
  getTierFilterOptions,
  getWebsiteDiscoveryCandidateLabel,
  getWebsiteDiscoveryConfirmationBadge,
  getWebsiteDiscoveryConfidenceBadge,
  getWebsiteDiscoveryLabel,
  getWebsiteDiscoveryReason,
  getWebsiteDiscoveryReviewedAtLabel,
  getWebsiteDiscoveryReviewSourceLabel,
  getWebsiteDiscoverySourceLabel,
  getWorkflowBadge,
  getWorkflowReason,
  listCompanyBundles,
  makeCountedOptions,
  matchesSearch,
  readSearchParam,
  type FilterOption,
  type RankedContactPreview,
  type SearchParamsInput,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import { getSelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export interface CompaniesWorkspaceFilters {
  q: string;
  icp: string;
  tier: string;
  readiness: string;
  companyId: string;
}

export interface CompanyListRowView {
  companyId: string;
  companyName: string;
  market: string;
  subindustry: string;
  reviewSnapshot: string;
  fitScore: string;
  priorityBadge: SelectorBadge;
  angleLabel: string;
  angleReason: string;
  angleUrgencyBadge: SelectorBadge;
  recommendedOffer: string;
  contactCoverage: string;
  decisionMakerConfidence: string;
  campaignStatus: string;
  readinessBadge: SelectorBadge;
}

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

export interface CompaniesWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: CompaniesWorkspaceFilters;
    icpOptions: FilterOption[];
    tierOptions: FilterOption[];
    readinessOptions: FilterOption[];
  };
  rows: CompanyListRowView[];
  selectedCompany?: CompanyDetailView;
  query: Record<string, string>;
  hasActiveFilters: boolean;
  resultLabel: string;
  emptyState: {
    title: string;
    description: string;
  };
}

function buildReadinessOptions(
  bundles: ReturnType<typeof listCompanyBundles>,
) {
  return makeCountedOptions(
    [
      { value: "all", label: "All readiness states" },
      { value: "ready", label: "Ready" },
      { value: "needs_enrichment", label: "Needs enrichment" },
      { value: "needs_review", label: "Needs review" },
      { value: "blocked", label: "Blocked" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) => deriveWorkflowState(bundle) === value).length,
  );
}

export async function getCompaniesWorkspaceView(
  searchParams: SearchParamsInput,
): Promise<CompaniesWorkspaceView> {
  const filters: CompaniesWorkspaceFilters = {
    q: readSearchParam(searchParams.q).trim(),
    icp: readSearchParam(searchParams.icp) || "all",
    tier: readSearchParam(searchParams.tier) || "all",
    readiness: readSearchParam(searchParams.readiness) || "all",
    companyId: readSearchParam(searchParams.companyId),
  };

  const snapshot = await getSelectorDataSnapshot();
  const bundles = listCompanyBundles(snapshot);
  const filteredBundles = bundles.filter((bundle) => {
    return (
      matchesSearch(bundle, filters.q) &&
      (filters.icp === "all" || bundle.company.icpProfileId === filters.icp) &&
      (filters.tier === "all" || bundle.company.priorityTier === filters.tier) &&
      (filters.readiness === "all" || deriveWorkflowState(bundle) === filters.readiness)
    );
  }).sort((left, right) => right.company.createdAt.localeCompare(left.company.createdAt));

  const selectedBundle =
    filteredBundles.find((bundle) => bundle.company.id === filters.companyId) ??
    filteredBundles[0];
  const selectedCampaignAssignment = selectedBundle
    ? buildCampaignAssignmentPanelView({
        bundles: [selectedBundle],
        snapshot,
      })
    : {
        campaignOptions: [],
        rows: [],
      };

  const rows = filteredBundles.map((bundle) => ({
    companyId: bundle.company.id,
    companyName: bundle.company.name,
    market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
    subindustry: getIndustryLabel(bundle.company),
    reviewSnapshot: getReviewSnapshot(bundle.company),
    fitScore: `${bundle.company.scoring.fitScore} fit • ${bundle.company.scoring.outreachReadinessScore} ready`,
    priorityBadge: getPriorityBadge(bundle.company.priorityTier),
    angleLabel: getOutreachAngleLabel(bundle.company),
    angleReason: getOutreachAngleReason(bundle.company),
    angleUrgencyBadge: getOutreachAngleUrgencyBadge(bundle.company),
    recommendedOffer: getRecommendedOfferName(bundle),
    contactCoverage: getContactCoverageLabel(bundle),
    decisionMakerConfidence: getDecisionMakerConfidenceLabel(bundle),
    campaignStatus: getCampaignStatusLabel(bundle),
    readinessBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
  }));

  const selectedCompany = selectedBundle
    ? {
        companyId: selectedBundle.company.id,
        companyName: selectedBundle.company.name,
        market: `${selectedBundle.company.location.city}, ${selectedBundle.company.location.state}`,
        subindustry: getIndustryLabel(selectedBundle.company),
        icpLabel: getIcpLabel(selectedBundle.company),
        reviewSnapshot: getReviewSnapshot(selectedBundle.company),
        priorityBadge: getPriorityBadge(selectedBundle.company.priorityTier),
        statusBadge: getCompanyStatusBadge(selectedBundle.company.status),
        readinessBadge: getWorkflowBadge(deriveWorkflowState(selectedBundle)),
        suggestedNextAction: getSuggestedNextAction(selectedBundle),
        basics: [
          {
            label: "Market",
            value: `${selectedBundle.company.location.city}, ${selectedBundle.company.location.state}`,
          },
          {
            label: "ICP profile",
            value: getIcpLabel(selectedBundle.company),
          },
          {
            label: "Monthly cars",
            value: selectedBundle.company.monthlyCarsSoldRange
              ? `${selectedBundle.company.monthlyCarsSoldRange.min ?? "?"}-${selectedBundle.company.monthlyCarsSoldRange.max ?? "?"} / month`
              : "Unknown",
          },
          {
            label: "Buying stage",
            value: selectedBundle.company.buyingStage.replaceAll("_", " "),
          },
          {
            label: "Tool count",
            value: selectedBundle.company.softwareToolCountEstimate
              ? `${selectedBundle.company.softwareToolCountEstimate} tools`
              : "Unknown",
          },
          {
            label: "Source",
            value: getSourceLabel(selectedBundle.company),
          },
          {
            label: "Imported",
            value: getImportDateLabel(selectedBundle.company),
          },
          {
            label: "Last enrichment",
            value: getLastEnrichedLabel(selectedBundle.company),
          },
          {
            label: "Discovery",
            value: getWebsiteDiscoveryLabel(selectedBundle.company),
          },
          {
            label: "Segment",
            value: getSegmentLabel(selectedBundle.company),
          },
          {
            label: "Workflow",
            value: getWorkflowReason(selectedBundle),
          },
        ],
        reputation: [
          {
            label: "Rating",
            value:
              selectedBundle.company.presence.googleRating != null
                ? `${selectedBundle.company.presence.googleRating.toFixed(1)} stars`
                : "Unknown",
          },
          {
            label: "Review count",
            value:
              selectedBundle.company.presence.reviewCount != null
                ? `${selectedBundle.company.presence.reviewCount} reviews`
                : "Unknown",
          },
          {
            label: "Response pattern",
            value: selectedBundle.company.presence.reviewResponseBand.replaceAll("_", " "),
          },
          {
            label: "Website + GBP",
            value: `${
              selectedBundle.company.presence.hasWebsite ? "Website" : "No website"
            } • ${
              selectedBundle.company.presence.hasClaimedGoogleBusinessProfile
                ? "Claimed GBP"
                : "No GBP"
            }`,
          },
          {
            label: "Parsed note hints",
            value: getNoteHintSummary(selectedBundle.company),
          },
        ],
        pains: selectedBundle.company.painSignals,
        notes: [
          ...(selectedBundle.company.notes ?? []),
          ...selectedBundle.company.scoring.reasons,
          ...(selectedBundle.primaryContact?.notes ?? []),
        ],
        outreachAngle: {
          label: getOutreachAngleLabel(selectedBundle.company),
          reason: getOutreachAngleReason(selectedBundle.company),
          urgencyBadge: getOutreachAngleUrgencyBadge(selectedBundle.company),
          confidenceBadge: getOutreachAngleConfidenceBadge(selectedBundle.company),
          reviewPathBadge: getOutreachAngleReviewPathBadge(selectedBundle.company),
          segmentLabel: getSegmentLabel(selectedBundle.company),
        },
        recommendedOffer: {
          name: selectedBundle.recommendedOffer?.name ?? "Offer pending",
          description:
            selectedBundle.recommendedOffer?.description ??
            "No offer has been assigned yet.",
          angle:
            selectedBundle.recommendedOffer?.firstOutreachAngle ??
            "Offer angle is still pending.",
          cta:
            selectedBundle.recommendedOffer?.primaryCta ??
            "CTA is still pending.",
        },
        confidenceBreakdown: [
          {
            label: "Website discovery confidence",
            value: getWebsiteDiscoveryConfidenceBadge(selectedBundle.company).label,
          },
          {
            label: "Primary contact quality",
            value: getContactQualityBadge(selectedBundle.primaryContact).label,
          },
          {
            label: "Outreach-angle confidence",
            value: getOutreachAngleConfidenceBadge(selectedBundle.company).label,
          },
          {
            label: "Overall readiness confidence",
            value: getReadinessConfidenceBadge(selectedBundle.company).label,
          },
        ],
        readinessConfidenceBadge: getReadinessConfidenceBadge(selectedBundle.company),
        websiteDiscovery: {
          label: getWebsiteDiscoveryLabel(selectedBundle.company),
          candidate: getWebsiteDiscoveryCandidateLabel(selectedBundle.company),
          candidateUrl:
            selectedBundle.company.enrichment?.websiteDiscovery?.candidateWebsite,
          officialWebsite:
            selectedBundle.company.presence.websiteUrl ??
            selectedBundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
          canReviewCandidate:
            selectedBundle.company.enrichment?.websiteDiscovery?.confirmationStatus === "needs_review",
          reason: getWebsiteDiscoveryReason(selectedBundle.company),
          sourceLabel: getWebsiteDiscoverySourceLabel(selectedBundle.company),
          reviewSourceLabel: getWebsiteDiscoveryReviewSourceLabel(selectedBundle.company),
          reviewedAtLabel: getWebsiteDiscoveryReviewedAtLabel(selectedBundle.company),
          confirmationBadge: getWebsiteDiscoveryConfirmationBadge(selectedBundle.company),
          confidenceBadge: getWebsiteDiscoveryConfidenceBadge(selectedBundle.company),
        },
        providerTransparency: {
          badge: getEnrichmentProviderBadge(selectedBundle.company),
          label: getEnrichmentProviderLabel(selectedBundle.company),
          fallback: getEnrichmentProviderFallbackLabel(selectedBundle.company),
          evidence: getEnrichmentProviderEvidenceLabel(selectedBundle.company),
          pageUsage: getSupportingPageUsageLabel(selectedBundle.company),
        },
        preferredSupportingPage: {
          url: getPreferredSupportingPage(selectedBundle.company)?.url,
          label: getPreferredSupportingPageLabel(selectedBundle.company),
          sourceLabel: getPreferredSupportingPageSourceLabel(selectedBundle.company),
          reason: getPreferredSupportingPage(selectedBundle.company)?.reason,
        },
        topRecommendedContact: {
          label: getDecisionMakerLabel(selectedBundle),
          reason: getPrimaryContactSelectionReason(selectedBundle),
          qualityBadge: getContactQualityBadge(selectedBundle.primaryContact),
        },
        contactSummary: {
          totalLabel: getRankedContactCountLabel(selectedBundle),
          highlights: getRankedContactPreviews(selectedBundle, 4),
        },
        contacts: selectedBundle.rankedContacts.map((selection) => {
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
              selectedBundle.company,
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
              ? getPrimaryContactReadinessReason(selectedBundle)
              : undefined,
            notes: contact.notes,
          };
        }),
        campaignSummary:
          selectedBundle.activeCampaigns.length > 0
            ? selectedBundle.activeCampaigns.map(
                (campaign) =>
                  `${campaign.name} • ${campaign.status} • ${campaign.objective}`,
              )
            : ["No active campaign is attached to this company yet."],
        campaignAssignment: selectedCampaignAssignment,
      }
    : undefined;

  const stats: WorkspaceStat[] = [
    {
      label: "Companies in view",
      value: String(filteredBundles.length),
      detail: "Dealer records currently visible in the intelligence workspace.",
      change: `${bundles.length} total tracked`,
      tone: "neutral",
    },
    {
      label: "Campaign-ready",
      value: String(
        filteredBundles.filter((bundle) => bundle.company.status === "campaign_ready").length,
      ),
      detail: "Companies that can move directly into outreach planning.",
      tone: "positive",
    },
    {
      label: "Average fit score",
      value: filteredBundles.length
        ? Math.round(
            filteredBundles.reduce(
              (sum, bundle) => sum + bundle.company.scoring.fitScore,
              0,
            ) / filteredBundles.length,
          ).toString()
        : "0",
      detail: "A quick signal for the quality of the current filtered set.",
      tone: "neutral",
    },
    {
      label: "Verified contacts",
      value: String(
        filteredBundles.flatMap((bundle) => bundle.contacts).filter((contact) => contact.status === "verified").length,
      ),
      detail: "Contacts with stronger confidence and lower review friction.",
      tone: "positive",
    },
  ];

  const query = cleanQuery({
    q: filters.q,
    icp: filters.icp !== "all" ? filters.icp : "",
    tier: filters.tier !== "all" ? filters.tier : "",
    readiness: filters.readiness !== "all" ? filters.readiness : "",
    companyId: selectedCompany?.companyId ?? "",
  });

  return {
    stats,
    filters: {
      values: filters,
      icpOptions: getIcpFilterOptions(bundles),
      tierOptions: getTierFilterOptions(bundles),
      readinessOptions: buildReadinessOptions(bundles),
    },
    rows,
    selectedCompany,
    query,
    hasActiveFilters: Object.keys({ ...query, companyId: undefined }).length > 1 ||
      Boolean(filters.q || filters.icp !== "all" || filters.tier !== "all" || filters.readiness !== "all"),
    resultLabel:
      filteredBundles.length === 1
        ? "1 company in view"
        : `${filteredBundles.length} companies in view`,
    emptyState: {
      title: "No companies match the current view",
      description:
        "Widen the search or readiness filters to bring more dealer records back into the intelligence workspace.",
    },
  };
}
