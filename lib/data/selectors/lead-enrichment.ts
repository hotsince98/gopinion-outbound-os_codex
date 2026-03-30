import { getCompanyHost } from "@/lib/data/contacts/quality";
import { buildCampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";
import {
  deriveWorkflowState,
  getContactCoverageLabel,
  getContactQualityBadge,
  getContactSourceLabel,
  getContactWarnings,
  getDecisionMakerLabel,
  getEnrichmentConfidenceBadge,
  getEnrichmentProviderBadge,
  getEnrichmentProviderEvidenceLabel,
  getEnrichmentProviderFallbackLabel,
  getEnrichmentProviderLabel,
  getEnrichmentSummary,
  getImportDateLabel,
  getIndustryLabel,
  getLastEnrichedLabel,
  getLatestReviewSignal,
  getMissingFieldsLabel,
  getNoteHintSummary,
  getOutreachAngleConfidenceBadge,
  getOutreachAngleLabel,
  getOutreachAngleReason,
  getOutreachAngleReviewPathBadge,
  getOutreachAngleUrgencyBadge,
  getPrimaryContactSelectionReason,
  getPreferredSupportingPageLabel,
  getPreferredSupportingPageSourceLabel,
  getRankedContactCountLabel,
  getRankedContactPreviews,
  getReadinessConfidenceBadge,
  getRecommendedOfferName,
  getSegmentLabel,
  getSupportingPageUsageLabel,
  getWebsiteDiscoveryCandidateLabel,
  getWebsiteDiscoveryConfirmationBadge,
  getWebsiteDiscoveryConfidenceBadge,
  getWebsiteDiscoveryLabel,
  getWebsiteDiscoveryReason,
  getWebsiteDiscoverySourceLabel,
  getWorkflowBadge,
  getWorkflowReason,
  hasWebsiteCandidate,
  listCompanyBundles,
  type CompanyBundle,
  type RankedContactPreview,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import { getSelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export interface LeadEnrichmentQueueRowView {
  companyId: string;
  companyName: string;
  market: string;
  website?: string;
  candidateWebsite?: string;
  websiteDiscovery: string;
  websiteDiscoveryBadge: SelectorBadge;
  websiteDiscoveryCandidate: string;
  websiteDiscoveryReason: string;
  websiteDiscoverySource: string;
  canReviewWebsiteCandidate: boolean;
  noteHintSummary: string;
  importedLabel: string;
  lastEnrichedLabel: string;
  subindustry: string;
  latestReviewBadge: SelectorBadge;
  latestReviewSummary: string;
  latestReviewSnippet?: string;
  latestReviewMetaLabel: string;
  latestReviewFilterState: "missing" | "monitor" | "fresh" | "urgent";
  angleLabel: string;
  angleReason: string;
  angleUrgencyBadge: SelectorBadge;
  angleConfidenceBadge: SelectorBadge;
  angleReviewPathBadge: SelectorBadge;
  readinessConfidenceBadge: SelectorBadge;
  segmentLabel: string;
  recommendedOffer: string;
  confidenceBadge: SelectorBadge;
  websiteDiscoveryConfidenceBadge: SelectorBadge;
  enrichmentSummary: string;
  providerBadge: SelectorBadge;
  providerLabel: string;
  providerFallbackLabel: string;
  providerEvidence: string;
  supportingPageUsage: string;
  missingFieldsLabel: string;
  contactCoverage: string;
  contactCountLabel: string;
  contactConfidenceBadge: SelectorBadge;
  contactCandidates: RankedContactPreview[];
  primaryContactLabel: string;
  secondaryContactLabel: string;
  namedCandidateSummary: string;
  relatedAccountSignals: string[];
  decisionMaker: string;
  primaryContactSource: string;
  primaryContactSelectionReason: string;
  primaryContactWarnings: string[];
  preferredSupportingPageLabel: string;
  preferredSupportingPageSource: string;
  readinessBadge: SelectorBadge;
  readinessReason: string;
  recommendedCampaignName: string;
  recommendedCampaignStatusBadge: SelectorBadge;
  assignmentDecisionBadge: SelectorBadge;
  assignmentDecisionReason: string;
}

export interface LeadEnrichmentWorkspaceView {
  stats: WorkspaceStat[];
  campaignAssignment: ReturnType<typeof buildCampaignAssignmentPanelView>;
  rows: LeadEnrichmentQueueRowView[];
  emptyState: {
    title: string;
    description: string;
  };
}

function buildSharedSignalMap(bundles: CompanyBundle[]) {
  const hostGroups = new Map<string, Set<string>>();
  const emailGroups = new Map<string, Set<string>>();
  const nameGroups = new Map<string, Set<string>>();

  for (const bundle of bundles) {
    const host = getCompanyHost(
      bundle.company.presence.websiteUrl ??
        bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
    );

    if (host) {
      const existing = hostGroups.get(host) ?? new Set<string>();
      existing.add(bundle.company.id);
      hostGroups.set(host, existing);
    }

    for (const contact of bundle.contacts) {
      if (contact.email) {
        const emailKey = contact.email.trim().toLowerCase();
        const existing = emailGroups.get(emailKey) ?? new Set<string>();
        existing.add(bundle.company.id);
        emailGroups.set(emailKey, existing);
      }

      if (contact.fullName) {
        const nameKey = contact.fullName.trim().toLowerCase();
        const existing = nameGroups.get(nameKey) ?? new Set<string>();
        existing.add(bundle.company.id);
        nameGroups.set(nameKey, existing);
      }
    }
  }

  return {
    hostGroups,
    emailGroups,
    nameGroups,
  };
}

function getRelatedAccountSignals(
  bundle: CompanyBundle,
  sharedSignals: ReturnType<typeof buildSharedSignalMap>,
) {
  const signals: string[] = [];
  const host = getCompanyHost(
    bundle.company.presence.websiteUrl ??
      bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
  );

  if (host) {
    const sharedHostCount = sharedSignals.hostGroups.get(host)?.size ?? 0;

    if (sharedHostCount > 1) {
      signals.push(
        `Website host pattern matches ${sharedHostCount - 1} other compan${
          sharedHostCount === 2 ? "y" : "ies"
        } in view`,
      );
    }
  }

  for (const contact of bundle.contacts) {
    if (contact.email) {
      const sharedEmailCount =
        sharedSignals.emailGroups.get(contact.email.trim().toLowerCase())?.size ?? 0;

      if (sharedEmailCount > 1) {
        signals.push(
          `Contact email ${contact.email} appears on ${sharedEmailCount} companies in view`,
        );
        break;
      }
    }
  }

  for (const contact of bundle.contacts) {
    if (contact.fullName) {
      const sharedNameCount =
        sharedSignals.nameGroups.get(contact.fullName.trim().toLowerCase())?.size ?? 0;

      if (sharedNameCount > 1) {
        signals.push(
          `Named contact ${contact.fullName} appears across ${sharedNameCount} companies in view`,
        );
        break;
      }
    }
  }

  return signals.slice(0, 3);
}

function getNamedCandidateSummary(bundle: CompanyBundle) {
  const namedSelections = bundle.rankedContacts.filter((selection) =>
    Boolean(selection.contact.fullName),
  );

  if (namedSelections.length === 0) {
    return "No named candidates were found on the current public pages yet.";
  }

  const primaryNamed = namedSelections.find((selection) => selection.isPrimary);

  if (primaryNamed?.contact.fullName) {
    return `${primaryNamed.contact.fullName} is the current primary named contact path.`;
  }

  const topNamedCandidates = namedSelections
    .slice(0, 2)
    .map((selection) => selection.contact.fullName)
    .filter((value): value is string => Boolean(value))
    .join(" • ");

  return `Named candidates were found (${topNamedCandidates}), but the business inbox stayed primary as the safer verified fallback.`;
}

export async function getLeadEnrichmentWorkspaceView(): Promise<LeadEnrichmentWorkspaceView> {
  const snapshot = await getSelectorDataSnapshot();
  const rows = listCompanyBundles(snapshot)
    .filter((bundle) => {
      const workflowState = deriveWorkflowState(bundle);

      return (
        workflowState === "needs_enrichment" ||
        workflowState === "needs_review" ||
        workflowState === "blocked"
      );
    })
    .sort((left, right) => {
      const reviewPriorityDelta =
        getLatestReviewSignal(right.company).priorityRank -
        getLatestReviewSignal(left.company).priorityRank;

      if (reviewPriorityDelta !== 0) {
        return reviewPriorityDelta;
      }

      return right.company.createdAt.localeCompare(left.company.createdAt);
    });
  const sharedSignals = buildSharedSignalMap(rows);
  const campaignAssignment = buildCampaignAssignmentPanelView({
    bundles: rows,
    snapshot,
  });
  const assignmentByCompanyId = new Map(
    campaignAssignment.rows.map((row) => [row.companyId, row] as const),
  );

  return {
    stats: [
      {
        label: "Open queue",
        value: String(rows.length),
        detail: "Companies still waiting on website discovery, enrichment review, or a minimum usable contact path.",
        tone: "warning",
      },
      {
        label: "Website candidate",
        value: String(rows.filter((bundle) => hasWebsiteCandidate(bundle.company)).length),
        detail: "Records with a discovered or recorded website that the queue can work from.",
        tone: "positive",
      },
      {
        label: "Parsed note hints",
        value: String(
          rows.filter((bundle) => (bundle.company.enrichment?.noteHints ?? []).length > 0)
            .length,
        ),
        detail: "Leads where imported notes already surfaced structured hints for enrichment.",
        tone: "neutral",
      },
      {
        label: "Review alerts",
        value: String(
          rows.filter(
            (bundle) => getLatestReviewSignal(bundle.company).filterState === "urgent",
          ).length,
        ),
        detail: "Fresh low-star or unanswered review context that should stay near the top of the queue.",
        tone: "warning",
      },
      {
        label: "Still blocked",
        value: String(
          rows.filter((bundle) => deriveWorkflowState(bundle) === "blocked").length,
        ),
        detail: "Records that still lack a verified website, phone, or usable primary contact path.",
        tone: "warning",
      },
    ],
    campaignAssignment,
    rows: rows.map((bundle) => {
      const assignment = assignmentByCompanyId.get(bundle.company.id);
      const contactCandidates = getRankedContactPreviews(bundle);
      const latestReview = getLatestReviewSignal(bundle.company);

      return {
        companyId: bundle.company.id,
        companyName: bundle.company.name,
        market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
        website:
          bundle.company.presence.websiteUrl ??
          bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
        candidateWebsite: bundle.company.enrichment?.websiteDiscovery?.candidateWebsite,
        websiteDiscovery: getWebsiteDiscoveryLabel(bundle.company),
        websiteDiscoveryBadge: getWebsiteDiscoveryConfirmationBadge(bundle.company),
        websiteDiscoveryCandidate: getWebsiteDiscoveryCandidateLabel(bundle.company),
        websiteDiscoveryReason: getWebsiteDiscoveryReason(bundle.company),
        websiteDiscoverySource: getWebsiteDiscoverySourceLabel(bundle.company),
        canReviewWebsiteCandidate:
          bundle.company.enrichment?.websiteDiscovery?.confirmationStatus === "needs_review",
        noteHintSummary: getNoteHintSummary(bundle.company),
        importedLabel: getImportDateLabel(bundle.company),
        lastEnrichedLabel: getLastEnrichedLabel(bundle.company),
        subindustry: getIndustryLabel(bundle.company),
        latestReviewBadge: latestReview.badge,
        latestReviewSummary: latestReview.summary,
        latestReviewSnippet: latestReview.snippet,
        latestReviewMetaLabel: latestReview.metaLabel,
        latestReviewFilterState: latestReview.filterState,
        angleLabel: getOutreachAngleLabel(bundle.company),
        angleReason: getOutreachAngleReason(bundle.company),
        angleUrgencyBadge: getOutreachAngleUrgencyBadge(bundle.company),
        angleConfidenceBadge: getOutreachAngleConfidenceBadge(bundle.company),
        angleReviewPathBadge: getOutreachAngleReviewPathBadge(bundle.company),
        readinessConfidenceBadge: getReadinessConfidenceBadge(bundle.company),
        segmentLabel: getSegmentLabel(bundle.company),
        recommendedOffer: getRecommendedOfferName(bundle),
        confidenceBadge: getEnrichmentConfidenceBadge(bundle.company),
        websiteDiscoveryConfidenceBadge: getWebsiteDiscoveryConfidenceBadge(bundle.company),
        enrichmentSummary: getEnrichmentSummary(bundle.company),
        providerBadge: getEnrichmentProviderBadge(bundle.company),
        providerLabel: getEnrichmentProviderLabel(bundle.company),
        providerFallbackLabel: getEnrichmentProviderFallbackLabel(bundle.company),
        providerEvidence: getEnrichmentProviderEvidenceLabel(bundle.company),
        supportingPageUsage: getSupportingPageUsageLabel(bundle.company),
        missingFieldsLabel: getMissingFieldsLabel(bundle.company),
        contactCoverage: getContactCoverageLabel(bundle),
        contactCountLabel: getRankedContactCountLabel(bundle),
        contactConfidenceBadge: getContactQualityBadge(bundle.primaryContact),
        contactCandidates,
        primaryContactLabel:
          contactCandidates[0]?.label ?? "Primary contact pending",
        secondaryContactLabel:
          contactCandidates[1]?.label ?? "No secondary contact yet",
        namedCandidateSummary: getNamedCandidateSummary(bundle),
        relatedAccountSignals: getRelatedAccountSignals(bundle, sharedSignals),
        decisionMaker: getDecisionMakerLabel(bundle),
        primaryContactSource: getContactSourceLabel(bundle.primaryContact),
        primaryContactSelectionReason: getPrimaryContactSelectionReason(bundle),
        primaryContactWarnings: getContactWarnings(bundle.primaryContact),
        preferredSupportingPageLabel: getPreferredSupportingPageLabel(bundle.company),
        preferredSupportingPageSource: getPreferredSupportingPageSourceLabel(bundle.company),
        readinessBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
        readinessReason: getWorkflowReason(bundle),
        recommendedCampaignName:
          assignment?.recommendedCampaignName ?? "Campaign pending",
        recommendedCampaignStatusBadge:
          assignment?.recommendedCampaignStatusBadge ?? {
            label: "Campaign pending",
            tone: "muted",
          },
        assignmentDecisionBadge: assignment?.decisionBadge ?? {
          label: "Review first",
          tone: "muted",
        },
        assignmentDecisionReason:
          assignment?.decisionReason ?? "Campaign assignment guidance is pending.",
      };
    }),
    emptyState: {
      title: "The enrichment queue is clear",
      description:
        "No companies currently need website discovery, enrichment, or review. Import more leads or reopen records that still need operator attention.",
    },
  };
}
