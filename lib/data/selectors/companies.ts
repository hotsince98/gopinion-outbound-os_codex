import {
  cleanQuery,
  deriveWorkflowState,
  getCampaignStatusLabel,
  getContactCoverageLabel,
  getDecisionMakerConfidenceLabel,
  getIcpFilterOptions,
  getIndustryLabel,
  getOutreachAngleLabel,
  getOutreachAngleReason,
  getOutreachAngleUrgencyBadge,
  getPriorityBadge,
  getRecommendedOfferName,
  getReviewSnapshot,
  getTierFilterOptions,
  getWorkflowBadge,
  listCompanyBundles,
  makeCountedOptions,
  matchesSearch,
  readSearchParam,
  type FilterOption,
  type SearchParamsInput,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import {
  buildCompanyDetailView,
  type CompanyDetailView,
} from "@/lib/data/selectors/company-profile";
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
    ? buildCompanyDetailView({
        bundle: selectedBundle,
        snapshot,
      })
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
