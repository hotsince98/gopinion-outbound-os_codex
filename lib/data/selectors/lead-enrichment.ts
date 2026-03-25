import { buildCampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";
import {
  deriveWorkflowState,
  getContactCoverageLabel,
  getContactSourceLabel,
  getContactWarnings,
  getDecisionMakerLabel,
  getEnrichmentConfidenceBadge,
  getEnrichmentSummary,
  getImportDateLabel,
  getIndustryLabel,
  getLastEnrichedLabel,
  getMissingFieldsLabel,
  getNoteHintSummary,
  getOutreachAngleConfidenceBadge,
  getOutreachAngleLabel,
  getOutreachAngleReason,
  getOutreachAngleReviewPathBadge,
  getOutreachAngleUrgencyBadge,
  getRecommendedOfferName,
  getSegmentLabel,
  getWebsiteDiscoveryLabel,
  getWorkflowBadge,
  getWorkflowReason,
  hasWebsiteCandidate,
  listCompanyBundles,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import { getSelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export interface LeadEnrichmentQueueRowView {
  companyId: string;
  companyName: string;
  market: string;
  website?: string;
  websiteDiscovery: string;
  noteHintSummary: string;
  importedLabel: string;
  lastEnrichedLabel: string;
  subindustry: string;
  angleLabel: string;
  angleReason: string;
  angleUrgencyBadge: SelectorBadge;
  angleConfidenceBadge: SelectorBadge;
  angleReviewPathBadge: SelectorBadge;
  segmentLabel: string;
  recommendedOffer: string;
  confidenceBadge: SelectorBadge;
  enrichmentSummary: string;
  missingFieldsLabel: string;
  contactCoverage: string;
  decisionMaker: string;
  primaryContactSource: string;
  primaryContactWarnings: string[];
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
    .sort((left, right) => right.company.createdAt.localeCompare(left.company.createdAt));
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

      return {
        companyId: bundle.company.id,
        companyName: bundle.company.name,
        market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
        website:
          bundle.company.presence.websiteUrl ??
          bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite,
        websiteDiscovery: getWebsiteDiscoveryLabel(bundle.company),
        noteHintSummary: getNoteHintSummary(bundle.company),
        importedLabel: getImportDateLabel(bundle.company),
        lastEnrichedLabel: getLastEnrichedLabel(bundle.company),
        subindustry: getIndustryLabel(bundle.company),
        angleLabel: getOutreachAngleLabel(bundle.company),
        angleReason: getOutreachAngleReason(bundle.company),
        angleUrgencyBadge: getOutreachAngleUrgencyBadge(bundle.company),
        angleConfidenceBadge: getOutreachAngleConfidenceBadge(bundle.company),
        angleReviewPathBadge: getOutreachAngleReviewPathBadge(bundle.company),
        segmentLabel: getSegmentLabel(bundle.company),
        recommendedOffer: getRecommendedOfferName(bundle),
        confidenceBadge: getEnrichmentConfidenceBadge(bundle.company),
        enrichmentSummary: getEnrichmentSummary(bundle.company),
        missingFieldsLabel: getMissingFieldsLabel(bundle.company),
        contactCoverage: getContactCoverageLabel(bundle),
        decisionMaker: getDecisionMakerLabel(bundle),
        primaryContactSource: getContactSourceLabel(bundle.primaryContact),
        primaryContactWarnings: getContactWarnings(bundle.primaryContact),
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
