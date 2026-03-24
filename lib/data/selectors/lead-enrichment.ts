import {
  deriveWorkflowState,
  getContactCoverageLabel,
  getDecisionMakerLabel,
  getEnrichmentConfidenceBadge,
  getEnrichmentSummary,
  getIndustryLabel,
  getLastEnrichedLabel,
  getMissingFieldsLabel,
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
  subindustry: string;
  confidenceBadge: SelectorBadge;
  enrichmentSummary: string;
  missingFieldsLabel: string;
  contactCoverage: string;
  decisionMaker: string;
  lastEnrichedLabel: string;
}

export interface LeadEnrichmentWorkspaceView {
  stats: WorkspaceStat[];
  rows: LeadEnrichmentQueueRowView[];
  emptyState: {
    title: string;
    description: string;
  };
}

export async function getLeadEnrichmentWorkspaceView(): Promise<LeadEnrichmentWorkspaceView> {
  const snapshot = await getSelectorDataSnapshot();
  const rows = listCompanyBundles(snapshot)
    .filter((bundle) => deriveWorkflowState(bundle) === "needs_enrichment")
    .sort((left, right) => right.company.createdAt.localeCompare(left.company.createdAt));

  return {
    stats: [
      {
        label: "Needs enrichment",
        value: String(rows.length),
        detail: "Companies still blocked on public web research or contact-path discovery.",
        tone: "warning",
      },
      {
        label: "Website available",
        value: String(rows.filter((bundle) => bundle.company.presence.websiteUrl).length),
        detail: "Records with a website the enrichment runner can inspect directly.",
        tone: "positive",
      },
      {
        label: "Contact path found",
        value: String(
          rows.filter((bundle) => bundle.company.enrichment?.foundEmails.length).length,
        ),
        detail: "Queue records where a usable email path is already visible from prior runs.",
        tone: "neutral",
      },
      {
        label: "Manual review flagged",
        value: String(
          rows.filter((bundle) => bundle.company.enrichment?.manualReviewRequired).length,
        ),
        detail: "Accounts that still need operator judgment after website enrichment.",
        tone: "warning",
      },
    ],
    rows: rows.map((bundle) => ({
      companyId: bundle.company.id,
      companyName: bundle.company.name,
      market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
      website: bundle.company.presence.websiteUrl,
      subindustry: getIndustryLabel(bundle.company),
      confidenceBadge: getEnrichmentConfidenceBadge(bundle.company),
      enrichmentSummary: getEnrichmentSummary(bundle.company),
      missingFieldsLabel: getMissingFieldsLabel(bundle.company),
      contactCoverage: getContactCoverageLabel(bundle),
      decisionMaker: getDecisionMakerLabel(bundle),
      lastEnrichedLabel: getLastEnrichedLabel(bundle.company),
    })),
    emptyState: {
      title: "The enrichment queue is clear",
      description:
        "No companies currently need website enrichment. Import more leads or reopen records that still need research.",
    },
  };
}
