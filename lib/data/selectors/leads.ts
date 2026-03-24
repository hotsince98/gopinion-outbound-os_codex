import {
  cleanQuery,
  deriveEnrichmentState,
  deriveWorkflowState,
  getCompanyStatusBadge,
  getContactCoverageLabel,
  getDecisionMakerConfidenceLabel,
  getDecisionMakerLabel,
  getEnrichmentBadge,
  getIcpFilterOptions,
  getIcpLabel,
  getIndustryLabel,
  getPriorityBadge,
  getRecommendedOfferName,
  getSuggestedNextAction,
  getTierFilterOptions,
  getWorkflowBadge,
  listCompanyBundles,
  makeCountedOptions,
  matchesSearch,
  readSearchParam,
  type EnrichmentState,
  type FilterOption,
  type SearchParamsInput,
  type SelectorBadge,
  type WorkspaceStat,
  type WorkflowState,
} from "@/lib/data/selectors/shared";
import { getSelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export interface LeadsWorkspaceFilters {
  q: string;
  icp: string;
  tier: string;
  enrichment: string;
  status: string;
  queue: string;
}

export interface LeadsQueueTab {
  value: string;
  label: string;
  count: number;
  active: boolean;
}

export interface LeadRowView {
  companyId: string;
  companyName: string;
  market: string;
  subindustry: string;
  icpLabel: string;
  priorityBadge: SelectorBadge;
  enrichmentBadge: SelectorBadge;
  statusBadge: SelectorBadge;
  queueBadge: SelectorBadge;
  recommendedOffer: string;
  decisionMaker: string;
  decisionMakerConfidence: string;
  contactCoverage: string;
  nextAction: string;
}

export interface LeadsWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: LeadsWorkspaceFilters;
    icpOptions: FilterOption[];
    tierOptions: FilterOption[];
    enrichmentOptions: FilterOption[];
    statusOptions: FilterOption[];
  };
  queueTabs: LeadsQueueTab[];
  rows: LeadRowView[];
  query: Record<string, string>;
  resultLabel: string;
  hasActiveFilters: boolean;
  emptyState: {
    title: string;
    description: string;
  };
}

function matchesEnrichment(value: string, enrichmentState: EnrichmentState) {
  return value === "all" || value === enrichmentState;
}

function matchesQueue(value: string, workflowState: WorkflowState) {
  return value === "all" || value === workflowState;
}

function buildEnrichmentOptions(
  bundles: ReturnType<typeof listCompanyBundles>,
) {
  return makeCountedOptions(
    [
      { value: "all", label: "All enrichment states" },
      { value: "needs_enrichment", label: "Needs enrichment" },
      { value: "enriched", label: "Enriched" },
      { value: "ready", label: "Ready" },
      { value: "blocked", label: "Blocked" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) => deriveEnrichmentState(bundle.company) === value).length,
  );
}

function buildCompanyStatusOptions(
  bundles: ReturnType<typeof listCompanyBundles>,
) {
  return makeCountedOptions(
    [
      { value: "all", label: "All company states" },
      { value: "new", label: "New" },
      { value: "enriched", label: "Enriched" },
      { value: "qualified", label: "Qualified" },
      { value: "campaign_ready", label: "Campaign ready" },
      { value: "disqualified", label: "Disqualified" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) => bundle.company.status === value).length,
  );
}

function getQueueTabs(
  bundles: ReturnType<typeof listCompanyBundles>,
  activeQueue: string,
): LeadsQueueTab[] {
  const items: Array<{ value: string; label: string }> = [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready" },
    { value: "needs_enrichment", label: "Needs enrichment" },
    { value: "needs_review", label: "Needs review" },
    { value: "blocked", label: "Blocked" },
  ];

  return items.map((item) => ({
    ...item,
    count:
      item.value === "all"
        ? bundles.length
        : bundles.filter((bundle) => deriveWorkflowState(bundle) === item.value).length,
    active: activeQueue === item.value,
  }));
}

export async function getLeadsWorkspaceView(
  searchParams: SearchParamsInput,
): Promise<LeadsWorkspaceView> {
  const filters: LeadsWorkspaceFilters = {
    q: readSearchParam(searchParams.q).trim(),
    icp: readSearchParam(searchParams.icp) || "all",
    tier: readSearchParam(searchParams.tier) || "all",
    enrichment: readSearchParam(searchParams.enrichment) || "all",
    status: readSearchParam(searchParams.status) || "all",
    queue: readSearchParam(searchParams.queue) || "all",
  };

  const snapshot = await getSelectorDataSnapshot();
  const bundles = listCompanyBundles(snapshot);
  const filteredBundles = bundles.filter((bundle) => {
    const enrichmentState = deriveEnrichmentState(bundle.company);
    const workflowState = deriveWorkflowState(bundle);

    return (
      matchesSearch(bundle, filters.q) &&
      (filters.icp === "all" || bundle.company.icpProfileId === filters.icp) &&
      (filters.tier === "all" || bundle.company.priorityTier === filters.tier) &&
      matchesEnrichment(filters.enrichment, enrichmentState) &&
      (filters.status === "all" || bundle.company.status === filters.status) &&
      matchesQueue(filters.queue, workflowState)
    );
  }).sort((left, right) => right.company.createdAt.localeCompare(left.company.createdAt));

  const rows = filteredBundles.map((bundle) => ({
    companyId: bundle.company.id,
    companyName: bundle.company.name,
    market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
    subindustry: getIndustryLabel(bundle.company),
    icpLabel: getIcpLabel(bundle.company),
    priorityBadge: getPriorityBadge(bundle.company.priorityTier),
    enrichmentBadge: getEnrichmentBadge(deriveEnrichmentState(bundle.company)),
    statusBadge: getCompanyStatusBadge(bundle.company.status),
    queueBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
    recommendedOffer: getRecommendedOfferName(bundle),
    decisionMaker: getDecisionMakerLabel(bundle),
    decisionMakerConfidence: getDecisionMakerConfidenceLabel(bundle),
    contactCoverage: getContactCoverageLabel(bundle),
    nextAction: getSuggestedNextAction(bundle),
  }));

  const stats: WorkspaceStat[] = [
    {
      label: "Total leads",
      value: String(filteredBundles.length),
      detail: "Prospect records currently in the operational intake queue.",
      change: `${bundles.length} in data layer`,
      tone: "neutral",
    },
    {
      label: "New leads",
      value: String(filteredBundles.filter((bundle) => bundle.company.status === "new").length),
      detail: "Fresh intake records that still need enrichment before operator review.",
      tone: "warning",
    },
    {
      label: "Enriched leads",
      value: String(
        filteredBundles.filter((bundle) =>
          ["enriched", "ready"].includes(deriveEnrichmentState(bundle.company)),
        ).length,
      ),
      detail: "Companies with enough profile data to support qualification or outreach prep.",
      tone: "positive",
    },
    {
      label: "High-priority leads",
      value: String(
        filteredBundles.filter((bundle) => bundle.company.priorityTier === "tier_1").length,
      ),
      detail: "Dream-fit accounts that deserve the most attention first.",
      tone: "positive",
    },
    {
      label: "Leads needing review",
      value: String(
        filteredBundles.filter((bundle) =>
          ["needs_enrichment", "needs_review"].includes(deriveWorkflowState(bundle)),
        ).length,
      ),
      detail: "Accounts blocked on enrichment, contact validation, or operator judgment.",
      tone: "warning",
    },
  ];

  const query = cleanQuery({
    q: filters.q,
    icp: filters.icp !== "all" ? filters.icp : "",
    tier: filters.tier !== "all" ? filters.tier : "",
    enrichment: filters.enrichment !== "all" ? filters.enrichment : "",
    status: filters.status !== "all" ? filters.status : "",
    queue: filters.queue !== "all" ? filters.queue : "",
  });

  return {
    stats,
    filters: {
      values: filters,
      icpOptions: getIcpFilterOptions(bundles),
      tierOptions: getTierFilterOptions(bundles),
      enrichmentOptions: buildEnrichmentOptions(bundles),
      statusOptions: buildCompanyStatusOptions(bundles),
    },
    queueTabs: getQueueTabs(bundles, filters.queue),
    rows,
    query,
    resultLabel:
      filteredBundles.length === 1
        ? "1 lead in view"
        : `${filteredBundles.length} leads in view`,
    hasActiveFilters: Object.keys(query).length > 0,
    emptyState: {
      title: "No leads match the current queue filters",
      description:
        "Try widening the ICP, status, or enrichment filters to bring more dealer records back into view.",
    },
  };
}
