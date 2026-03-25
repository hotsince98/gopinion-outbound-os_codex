import { buildCampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";
import {
  cleanQuery,
  deriveEnrichmentState,
  deriveWorkflowState,
  getCompanyStatusBadge,
  getContactCoverageLabel,
  getContactWarnings,
  getDecisionMakerConfidenceLabel,
  getDecisionMakerLabel,
  getEnrichmentBadge,
  getEnrichmentConfidenceBadge,
  getEnrichmentSummary,
  getIcpFilterOptions,
  getIcpLabel,
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
  getPriorityBadge,
  getContactSourceLabel,
  getRecommendedOfferName,
  getSegmentAngle,
  getSegmentLabel,
  getSourceLabel,
  getSuggestedNextAction,
  getTierFilterOptions,
  getWebsiteDiscoveryLabel,
  getWorkflowBadge,
  getWorkflowReason,
  hasAnyContactPath,
  hasWebsiteCandidate,
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

type TimeWindowFilter = "all" | "today" | "yesterday" | "last_7_days";
type EnrichedWindowFilter = "all" | "today" | "last_7_days" | "not_enriched";
type PresenceFilter = "all" | "has" | "missing";
type PrimarySelectionFilter = "all" | "selected" | "missing";
type ConfidenceFilter = "all" | "high" | "medium" | "low" | "none";
type LeadSortOption =
  | "newest"
  | "oldest"
  | "recently_enriched"
  | "highest_confidence"
  | "highest_priority";

export interface LeadsWorkspaceFilters {
  q: string;
  icp: string;
  tier: string;
  enrichment: string;
  status: string;
  queue: string;
  imported: TimeWindowFilter;
  enriched: EnrichedWindowFilter;
  state: string;
  city: string;
  source: string;
  website: PresenceFilter;
  contact: PresenceFilter;
  primary: PrimarySelectionFilter;
  confidence: ConfidenceFilter;
  sort: LeadSortOption;
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
  confidenceBadge: SelectorBadge;
  statusBadge: SelectorBadge;
  queueBadge: SelectorBadge;
  recommendedOffer: string;
  decisionMaker: string;
  decisionMakerConfidence: string;
  contactCoverage: string;
  primaryContactSource: string;
  primaryContactWarnings: string[];
  enrichmentSummary: string;
  missingFieldsLabel: string;
  lastEnrichedLabel: string;
  importedLabel: string;
  sourceLabel: string;
  websiteLabel: string;
  websiteDiscovery: string;
  noteHintSummary: string;
  angleLabel: string;
  angleReason: string;
  angleUrgencyBadge: SelectorBadge;
  angleConfidenceBadge: SelectorBadge;
  angleReviewPathBadge: SelectorBadge;
  segmentLabel: string;
  segmentAngle: string;
  workflowReason: string;
  nextAction: string;
  recommendedCampaignName: string;
  recommendedCampaignStatusBadge: SelectorBadge;
  assignmentDecisionBadge: SelectorBadge;
  assignmentDecisionReason: string;
}

export interface LeadsWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: LeadsWorkspaceFilters;
    icpOptions: FilterOption[];
    tierOptions: FilterOption[];
    enrichmentOptions: FilterOption[];
    statusOptions: FilterOption[];
    importedOptions: FilterOption[];
    enrichedOptions: FilterOption[];
    stateOptions: FilterOption[];
    cityOptions: FilterOption[];
    sourceOptions: FilterOption[];
    websiteOptions: FilterOption[];
    contactOptions: FilterOption[];
    primaryOptions: FilterOption[];
    confidenceOptions: FilterOption[];
    sortOptions: Array<{ value: LeadSortOption; label: string }>;
  };
  queueTabs: LeadsQueueTab[];
  campaignAssignment: ReturnType<typeof buildCampaignAssignmentPanelView>;
  rows: LeadRowView[];
  query: Record<string, string>;
  resultLabel: string;
  hasActiveFilters: boolean;
  emptyState: {
    title: string;
    description: string;
  };
}

function startOfToday() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function matchesCreatedWindow(value: TimeWindowFilter, isoDate: string) {
  if (value === "all") {
    return true;
  }

  const target = new Date(isoDate);
  const todayStart = startOfToday();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  switch (value) {
    case "today":
      return target >= todayStart;
    case "yesterday":
      return target >= yesterdayStart && target < todayStart;
    case "last_7_days":
      return target >= lastWeekStart;
    default:
      return true;
  }
}

function matchesEnrichedWindow(value: EnrichedWindowFilter, isoDate: string | undefined) {
  if (value === "all") {
    return true;
  }

  if (value === "not_enriched") {
    return !isoDate;
  }

  if (!isoDate) {
    return false;
  }

  const target = new Date(isoDate);
  const todayStart = startOfToday();
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  switch (value) {
    case "today":
      return target >= todayStart;
    case "last_7_days":
      return target >= lastWeekStart;
    default:
      return true;
  }
}

function matchesEnrichment(value: string, enrichmentState: EnrichmentState) {
  return value === "all" || value === enrichmentState;
}

function matchesQueue(value: string, workflowState: WorkflowState) {
  return value === "all" || value === workflowState;
}

function matchesPresenceFilter(value: PresenceFilter, hasValue: boolean) {
  return value === "all" || (value === "has" ? hasValue : !hasValue);
}

function matchesPrimaryFilter(
  value: PrimarySelectionFilter,
  hasPrimaryContact: boolean,
) {
  return (
    value === "all" ||
    (value === "selected" ? hasPrimaryContact : !hasPrimaryContact)
  );
}

function matchesConfidenceFilter(
  value: ConfidenceFilter,
  confidence: "none" | "low" | "medium" | "high",
) {
  return value === "all" || value === confidence;
}

function buildEnrichmentOptions(bundles: ReturnType<typeof listCompanyBundles>) {
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

function buildCompanyStatusOptions(bundles: ReturnType<typeof listCompanyBundles>) {
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

function buildTimeWindowOptions(bundles: ReturnType<typeof listCompanyBundles>) {
  return makeCountedOptions(
    [
      { value: "all", label: "All import dates" },
      { value: "today", label: "Imported today" },
      { value: "yesterday", label: "Imported yesterday" },
      { value: "last_7_days", label: "Imported last 7 days" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) =>
            matchesCreatedWindow(value as TimeWindowFilter, bundle.company.createdAt),
          ).length,
  );
}

function buildEnrichedWindowOptions(bundles: ReturnType<typeof listCompanyBundles>) {
  return makeCountedOptions(
    [
      { value: "all", label: "All enrichment dates" },
      { value: "today", label: "Enriched today" },
      { value: "last_7_days", label: "Enriched last 7 days" },
      { value: "not_enriched", label: "Not enriched yet" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) =>
            matchesEnrichedWindow(
              value as EnrichedWindowFilter,
              bundle.company.enrichment?.lastEnrichedAt,
            ),
          ).length,
  );
}

function buildUniqueValueOptions(params: {
  bundles: ReturnType<typeof listCompanyBundles>;
  values: (bundle: ReturnType<typeof listCompanyBundles>[number]) => string | undefined;
  allLabel: string;
  labelForValue?: (value: string) => string;
}) {
  const uniqueValues = Array.from(
    new Set(
      params.bundles
        .map((bundle) => params.values(bundle)?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return makeCountedOptions(
    [
      { value: "all", label: params.allLabel },
      ...uniqueValues.map((value) => ({
        value,
        label: params.labelForValue ? params.labelForValue(value) : value,
      })),
    ],
    (value) =>
      value === "all"
        ? params.bundles.length
        : params.bundles.filter((bundle) => params.values(bundle) === value).length,
  );
}

function buildPresenceOptions(
  bundles: ReturnType<typeof listCompanyBundles>,
  labels: {
    all: string;
    has: string;
    missing: string;
  },
  predicate: (bundle: ReturnType<typeof listCompanyBundles>[number]) => boolean,
) {
  return makeCountedOptions(
    [
      { value: "all", label: labels.all },
      { value: "has", label: labels.has },
      { value: "missing", label: labels.missing },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) =>
            matchesPresenceFilter(value as PresenceFilter, predicate(bundle)),
          ).length,
  );
}

function buildPrimaryOptions(bundles: ReturnType<typeof listCompanyBundles>) {
  return makeCountedOptions(
    [
      { value: "all", label: "All primary states" },
      { value: "selected", label: "Primary selected" },
      { value: "missing", label: "Primary missing" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) =>
            matchesPrimaryFilter(value as PrimarySelectionFilter, Boolean(bundle.primaryContact)),
          ).length,
  );
}

function buildConfidenceOptions(bundles: ReturnType<typeof listCompanyBundles>) {
  return makeCountedOptions(
    [
      { value: "all", label: "All confidence tiers" },
      { value: "high", label: "High confidence" },
      { value: "medium", label: "Medium confidence" },
      { value: "low", label: "Low confidence" },
      { value: "none", label: "Confidence pending" },
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) =>
            matchesConfidenceFilter(
              value as ConfidenceFilter,
              bundle.company.enrichment?.confidenceLevel ?? "none",
            ),
          ).length,
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

function getPrioritySortValue(tier: string) {
  switch (tier) {
    case "tier_1":
      return 3;
    case "tier_2":
      return 2;
    case "tier_3":
    default:
      return 1;
  }
}

function sortBundles(
  bundles: ReturnType<typeof listCompanyBundles>,
  sort: LeadSortOption,
) {
  return [...bundles].sort((left, right) => {
    switch (sort) {
      case "oldest":
        return left.company.createdAt.localeCompare(right.company.createdAt);
      case "recently_enriched":
        return (
          (right.company.enrichment?.lastEnrichedAt ?? "").localeCompare(
            left.company.enrichment?.lastEnrichedAt ?? "",
          ) || right.company.createdAt.localeCompare(left.company.createdAt)
        );
      case "highest_confidence":
        return (
          (right.company.enrichment?.confidenceScore ?? 0) -
            (left.company.enrichment?.confidenceScore ?? 0) ||
          right.company.createdAt.localeCompare(left.company.createdAt)
        );
      case "highest_priority":
        return (
          getPrioritySortValue(right.company.priorityTier) -
            getPrioritySortValue(left.company.priorityTier) ||
          right.company.scoring.fitScore - left.company.scoring.fitScore ||
          right.company.createdAt.localeCompare(left.company.createdAt)
        );
      case "newest":
      default:
        return right.company.createdAt.localeCompare(left.company.createdAt);
    }
  });
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
    imported: (readSearchParam(searchParams.imported) || "all") as TimeWindowFilter,
    enriched: (readSearchParam(searchParams.enriched) || "all") as EnrichedWindowFilter,
    state: readSearchParam(searchParams.state) || "all",
    city: readSearchParam(searchParams.city) || "all",
    source: readSearchParam(searchParams.source) || "all",
    website: (readSearchParam(searchParams.website) || "all") as PresenceFilter,
    contact: (readSearchParam(searchParams.contact) || "all") as PresenceFilter,
    primary: (readSearchParam(searchParams.primary) || "all") as PrimarySelectionFilter,
    confidence: (readSearchParam(searchParams.confidence) || "all") as ConfidenceFilter,
    sort: (readSearchParam(searchParams.sort) || "newest") as LeadSortOption,
  };

  const snapshot = await getSelectorDataSnapshot();
  const bundles = listCompanyBundles(snapshot);
  const filteredBundles = sortBundles(
    bundles.filter((bundle) => {
      const enrichmentState = deriveEnrichmentState(bundle.company);
      const workflowState = deriveWorkflowState(bundle);
      const confidenceLevel = bundle.company.enrichment?.confidenceLevel ?? "none";

      return (
        matchesSearch(bundle, filters.q) &&
        (filters.icp === "all" || bundle.company.icpProfileId === filters.icp) &&
        (filters.tier === "all" || bundle.company.priorityTier === filters.tier) &&
        matchesEnrichment(filters.enrichment, enrichmentState) &&
        (filters.status === "all" || bundle.company.status === filters.status) &&
        matchesQueue(filters.queue, workflowState) &&
        matchesCreatedWindow(filters.imported, bundle.company.createdAt) &&
        matchesEnrichedWindow(filters.enriched, bundle.company.enrichment?.lastEnrichedAt) &&
        (filters.state === "all" || bundle.company.location.state === filters.state) &&
        (filters.city === "all" || bundle.company.location.city === filters.city) &&
        (filters.source === "all" || bundle.company.source.provider === filters.source) &&
        matchesPresenceFilter(filters.website, hasWebsiteCandidate(bundle.company)) &&
        matchesPresenceFilter(filters.contact, hasAnyContactPath(bundle)) &&
        matchesPrimaryFilter(filters.primary, Boolean(bundle.primaryContact)) &&
        matchesConfidenceFilter(filters.confidence, confidenceLevel)
      );
    }),
    filters.sort,
  );
  const campaignAssignment = buildCampaignAssignmentPanelView({
    bundles: filteredBundles,
    snapshot,
  });
  const assignmentByCompanyId = new Map(
    campaignAssignment.rows.map((row) => [row.companyId, row] as const),
  );

  const rows = filteredBundles.map((bundle) => {
    const assignment = assignmentByCompanyId.get(bundle.company.id);

    return {
      companyId: bundle.company.id,
      companyName: bundle.company.name,
      market: `${bundle.company.location.city}, ${bundle.company.location.state}`,
      subindustry: getIndustryLabel(bundle.company),
      icpLabel: getIcpLabel(bundle.company),
      priorityBadge: getPriorityBadge(bundle.company.priorityTier),
      enrichmentBadge: getEnrichmentBadge(deriveEnrichmentState(bundle.company)),
      confidenceBadge: getEnrichmentConfidenceBadge(bundle.company),
      statusBadge: getCompanyStatusBadge(bundle.company.status),
      queueBadge: getWorkflowBadge(deriveWorkflowState(bundle)),
      recommendedOffer: getRecommendedOfferName(bundle),
      decisionMaker: getDecisionMakerLabel(bundle),
      decisionMakerConfidence: getDecisionMakerConfidenceLabel(bundle),
      contactCoverage: getContactCoverageLabel(bundle),
      primaryContactSource: getContactSourceLabel(bundle.primaryContact),
      primaryContactWarnings: getContactWarnings(bundle.primaryContact),
      enrichmentSummary: getEnrichmentSummary(bundle.company),
      missingFieldsLabel: getMissingFieldsLabel(bundle.company),
      lastEnrichedLabel: getLastEnrichedLabel(bundle.company),
      importedLabel: getImportDateLabel(bundle.company),
      sourceLabel: getSourceLabel(bundle.company),
      websiteLabel:
        bundle.company.presence.websiteUrl ??
        bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite ??
        "No website on record",
      websiteDiscovery: getWebsiteDiscoveryLabel(bundle.company),
      noteHintSummary: getNoteHintSummary(bundle.company),
      angleLabel: getOutreachAngleLabel(bundle.company),
      angleReason: getOutreachAngleReason(bundle.company),
      angleUrgencyBadge: getOutreachAngleUrgencyBadge(bundle.company),
      angleConfidenceBadge: getOutreachAngleConfidenceBadge(bundle.company),
      angleReviewPathBadge: getOutreachAngleReviewPathBadge(bundle.company),
      segmentLabel: getSegmentLabel(bundle.company),
      segmentAngle: getSegmentAngle(bundle.company),
      workflowReason: getWorkflowReason(bundle),
      nextAction: getSuggestedNextAction(bundle),
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
  });

  const stats: WorkspaceStat[] = [
    {
      label: "Visible leads",
      value: String(filteredBundles.length),
      detail: "Prospect records currently in the operational intake queue.",
      change: `${bundles.length} total in the data layer`,
      tone: "neutral",
    },
    {
      label: "Imported today",
      value: String(
        filteredBundles.filter((bundle) =>
          matchesCreatedWindow("today", bundle.company.createdAt),
        ).length,
      ),
      detail: "Fresh intake records that likely need the fastest operator attention.",
      tone: "warning",
    },
    {
      label: "No website yet",
      value: String(
        filteredBundles.filter((bundle) => !hasWebsiteCandidate(bundle.company)).length,
      ),
      detail: "Records where website discovery still matters before enrichment can do much work.",
      tone: "warning",
    },
    {
      label: "Ready now",
      value: String(
        filteredBundles.filter((bundle) => deriveWorkflowState(bundle) === "ready").length,
      ),
      detail: "Leads with a campaign-eligible path forward right now.",
      tone: "positive",
    },
    {
      label: "Still blocked",
      value: String(
        filteredBundles.filter((bundle) => deriveWorkflowState(bundle) === "blocked").length,
      ),
      detail: "Truly blocked leads with no verified website, phone, or usable contact path.",
      tone: "warning",
    },
  ];

  const query = cleanQuery({
    q: filters.q,
    icp: filters.icp === "all" ? "" : filters.icp,
    tier: filters.tier === "all" ? "" : filters.tier,
    enrichment: filters.enrichment === "all" ? "" : filters.enrichment,
    status: filters.status === "all" ? "" : filters.status,
    queue: filters.queue === "all" ? "" : filters.queue,
    imported: filters.imported === "all" ? "" : filters.imported,
    enriched: filters.enriched === "all" ? "" : filters.enriched,
    state: filters.state === "all" ? "" : filters.state,
    city: filters.city === "all" ? "" : filters.city,
    source: filters.source === "all" ? "" : filters.source,
    website: filters.website === "all" ? "" : filters.website,
    contact: filters.contact === "all" ? "" : filters.contact,
    primary: filters.primary === "all" ? "" : filters.primary,
    confidence: filters.confidence === "all" ? "" : filters.confidence,
    sort: filters.sort === "newest" ? "" : filters.sort,
  });

  return {
    stats,
    filters: {
      values: filters,
      icpOptions: getIcpFilterOptions(bundles),
      tierOptions: getTierFilterOptions(bundles),
      enrichmentOptions: buildEnrichmentOptions(bundles),
      statusOptions: buildCompanyStatusOptions(bundles),
      importedOptions: buildTimeWindowOptions(bundles),
      enrichedOptions: buildEnrichedWindowOptions(bundles),
      stateOptions: buildUniqueValueOptions({
        bundles,
        values: (bundle) => bundle.company.location.state,
        allLabel: "All states / provinces",
      }),
      cityOptions: buildUniqueValueOptions({
        bundles,
        values: (bundle) => bundle.company.location.city,
        allLabel: "All cities",
      }),
      sourceOptions: buildUniqueValueOptions({
        bundles,
        values: (bundle) => bundle.company.source.provider,
        allLabel: "All sources",
        labelForValue: (value) =>
          value
            .replaceAll("_", " ")
            .replace(/\b\w/g, (match) => match.toUpperCase()),
      }),
      websiteOptions: buildPresenceOptions(
        bundles,
        {
          all: "All website states",
          has: "Has website",
          missing: "No website",
        },
        (bundle) => hasWebsiteCandidate(bundle.company),
      ),
      contactOptions: buildPresenceOptions(
        bundles,
        {
          all: "All contact states",
          has: "Has contact path",
          missing: "No contact path",
        },
        (bundle) => hasAnyContactPath(bundle),
      ),
      primaryOptions: buildPrimaryOptions(bundles),
      confidenceOptions: buildConfidenceOptions(bundles),
      sortOptions: [
        { value: "newest", label: "Newest imports" },
        { value: "oldest", label: "Oldest imports" },
        { value: "recently_enriched", label: "Recently enriched" },
        { value: "highest_confidence", label: "Highest confidence" },
        { value: "highest_priority", label: "Highest priority" },
      ],
    },
    queueTabs: getQueueTabs(bundles, filters.queue),
    campaignAssignment,
    rows,
    query,
    resultLabel:
      filteredBundles.length === bundles.length
        ? `${filteredBundles.length} leads in the active workspace`
        : `${filteredBundles.length} of ${bundles.length} leads matched the current filters`,
    hasActiveFilters: Object.keys(query).length > 0,
    emptyState: {
      title: "No leads match these filters",
      description:
        "Try widening the time window, removing a geography filter, or clearing the queue state to bring more leads back into view.",
    },
  };
}
