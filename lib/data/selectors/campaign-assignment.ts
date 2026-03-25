import {
  buildCampaignAssignmentRecommendation,
} from "@/lib/data/campaigns/assignment";
import type { CompanyBundle } from "@/lib/data/company/workflow";
import {
  deriveWorkflowState,
} from "@/lib/data/company/workflow";
import {
  getCampaignStatusLabel,
  getEnrichmentConfidenceBadge,
  getLastEnrichedLabel,
  getRecommendedOfferName,
  getWorkflowBadge,
  type SelectorBadge,
} from "@/lib/data/selectors/shared";
import type { SelectorDataSnapshot } from "@/lib/data/selectors/snapshot";
import type { CampaignStatus } from "@/lib/domain";

export interface CampaignAssignmentOptionView {
  value: string;
  label: string;
  detail: string;
}

export interface CampaignAssignmentCandidateView {
  companyId: string;
  companyName: string;
  market: string;
  readinessBadge: SelectorBadge;
  confidenceBadge: SelectorBadge;
  angleLabel: string;
  angleReason: string;
  recommendedOffer: string;
  recommendedCampaignId?: string;
  recommendedCampaignName: string;
  recommendedCampaignStatusBadge: SelectorBadge;
  decisionBadge: SelectorBadge;
  decisionReason: string;
  primaryContactLabel: string;
  primaryContactSource: string;
  primaryContactQuality: string;
  primaryContactWarnings: string[];
  manualReviewRequired: boolean;
  campaignReviewRequired: boolean;
  canAssign: boolean;
  canEnroll: boolean;
  currentCampaignLabel: string;
  lastEnrichedLabel: string;
}

export interface CampaignAssignmentPanelView {
  campaignOptions: CampaignAssignmentOptionView[];
  rows: CampaignAssignmentCandidateView[];
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getCampaignStatusBadge(status: CampaignStatus | undefined): SelectorBadge {
  switch (status) {
    case "active":
      return { label: "Active campaign", tone: "success" };
    case "paused":
      return { label: "Paused campaign", tone: "warning" };
    case "draft":
      return { label: "Draft campaign", tone: "accent" };
    case "completed":
      return { label: "Completed campaign", tone: "muted" };
    case "archived":
      return { label: "Archived campaign", tone: "muted" };
    default:
      return { label: "Campaign pending", tone: "muted" };
  }
}

function getDecisionBadge(
  decision: ReturnType<typeof buildCampaignAssignmentRecommendation>["decision"],
): SelectorBadge {
  switch (decision) {
    case "enroll_now":
      return { label: "Enroll now", tone: "success" };
    case "review_before_enrollment":
      return { label: "Review first", tone: "accent" };
    case "blocked":
      return { label: "Blocked", tone: "danger" };
  }
}

function sortCampaignOptions(snapshot: SelectorDataSnapshot) {
  return [...snapshot.campaigns]
    .filter((campaign) => campaign.status !== "completed" && campaign.status !== "archived")
    .sort((left, right) => {
      const order = (status: CampaignStatus) => {
        switch (status) {
          case "active":
            return 0;
          case "paused":
            return 1;
          case "draft":
            return 2;
          case "completed":
            return 3;
          case "archived":
            return 4;
        }
      };

      return (
        order(left.status) - order(right.status) || left.name.localeCompare(right.name)
      );
    })
    .map((campaign) => ({
      value: campaign.id,
      label: campaign.name,
      detail: `${formatLabel(campaign.status)} • ${campaign.targetTier.replaceAll("_", " ")} • ${campaign.offerId.replace(/^offer_/, "").replaceAll("_", " ")}`,
    }));
}

export function buildCampaignAssignmentPanelView(params: {
  bundles: CompanyBundle[];
  snapshot: SelectorDataSnapshot;
}): CampaignAssignmentPanelView {
  return {
    campaignOptions: sortCampaignOptions(params.snapshot),
    rows: params.bundles.map((bundle) => {
      const recommendation = buildCampaignAssignmentRecommendation({
        bundle,
        snapshot: params.snapshot,
      });

      return {
        companyId: bundle.company.id,
        companyName: bundle.company.name,
        market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
        readinessBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
        confidenceBadge: getEnrichmentConfidenceBadge(bundle.company),
        angleLabel: recommendation.angleLabel,
        angleReason: recommendation.angleReason,
        recommendedOffer:
          recommendation.recommendedOfferName ?? getRecommendedOfferName(bundle),
        recommendedCampaignId: recommendation.recommendedCampaignId,
        recommendedCampaignName:
          recommendation.recommendedCampaignName ?? "Campaign pending",
        recommendedCampaignStatusBadge: getCampaignStatusBadge(
          recommendation.recommendedCampaignStatus,
        ),
        decisionBadge: getDecisionBadge(recommendation.decision),
        decisionReason: recommendation.decisionReason,
        primaryContactLabel: recommendation.primaryContactLabel,
        primaryContactSource: recommendation.primaryContactSource,
        primaryContactQuality: recommendation.primaryContactQuality,
        primaryContactWarnings: recommendation.primaryContactWarnings,
        manualReviewRequired: recommendation.manualReviewRequired,
        campaignReviewRequired: recommendation.campaignReviewRequired,
        canAssign: recommendation.decision !== "blocked",
        canEnroll: recommendation.decision === "enroll_now",
        currentCampaignLabel: getCampaignStatusLabel(bundle),
        lastEnrichedLabel: getLastEnrichedLabel(bundle.company),
      };
    }),
  };
}
