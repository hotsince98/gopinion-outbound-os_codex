import { initialIcpProfiles } from "@/lib/data/config/icp";
import { initialOffers } from "@/lib/data/config/offers";
import { priorityTierDefinitions, scoringBuckets } from "@/lib/data/config/priority-tiers";
import {
  icpControlConfigurations,
  integrationReadinessChecks,
  learningConfiguration,
  workflowChannelConfigurations,
} from "@/lib/data/config/settings";
import { getDataAccess } from "@/lib/data/access";
import {
  getPriorityBadge,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import type {
  IcpProfile,
  IntegrationReadinessCheck,
  IntegrationReadinessStatus,
  LearningConfiguration,
  LearningOutcomeConfiguration,
  LearningTrackingStatus,
  MemoryEntryKind,
  Offer,
  PriorityTierDefinition,
  ScoringBucket,
  WorkflowApprovalMode,
  WorkflowChannelConfiguration,
  WorkflowChannelStatus,
} from "@/lib/domain";

const dataAccess = getDataAccess();
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const icpControlById = new Map(
  icpControlConfigurations.map((configuration) => [
    configuration.profileId,
    configuration,
  ]),
);

const offerByCategory = new Map(
  initialOffers.map((offer) => [offer.category, offer] as const),
);

export interface SettingsIcpConfigurationView {
  profile: IcpProfile;
  statusBadge: SelectorBadge;
  targetIndustriesLabel: string;
  targetSubindustriesLabel: string;
  preferredChannelLabels: string[];
  dreamSummary: string;
  tierTwoSummary: string;
  avoidSummary: string;
  firstOfferName: string;
  firstOfferCategoryLabel: string;
}

export interface SettingsOfferConfigurationView {
  offer: Offer;
  statusBadge: SelectorBadge;
  categoryLabel: string;
  roleLabel: string;
  usageLabel: string;
  pricingNotes: string;
  ctaGuidance: string;
}

export interface SettingsScoringConfigurationView {
  definition: PriorityTierDefinition;
  scoringBucket?: ScoringBucket;
  priorityBadge: SelectorBadge;
  recommendedChannelsLabel: string;
  recommendedOfferLabel: string;
  scoreRangeLabel: string;
  routingNote: string;
}

export interface SettingsWorkflowConfigurationView {
  configuration: WorkflowChannelConfiguration;
  statusBadge: SelectorBadge;
  roleLabel: string;
  approvalModeLabel: string;
  usageLabel: string;
}

export interface SettingsLearningOutcomeView {
  configuration: LearningOutcomeConfiguration;
  statusBadge: SelectorBadge;
  currentSignalLabel: string;
}

export interface SettingsMemoryCategoryView {
  kind: MemoryEntryKind;
  label: string;
  countLabel: string;
  summary: string;
}

export interface SettingsLearningView {
  configuration: LearningConfiguration;
  outcomes: SettingsLearningOutcomeView[];
  memoryCategories: SettingsMemoryCategoryView[];
}

export interface SettingsIntegrationReadinessView {
  check: IntegrationReadinessCheck;
  statusBadge: SelectorBadge;
}

export interface SettingsWorkspaceView {
  stats: WorkspaceStat[];
  icpConfigurations: SettingsIcpConfigurationView[];
  offerConfigurations: SettingsOfferConfigurationView[];
  scoringConfigurations: SettingsScoringConfigurationView[];
  workflowConfigurations: SettingsWorkflowConfigurationView[];
  learning: SettingsLearningView;
  integrationReadiness: SettingsIntegrationReadinessView[];
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatOfferCategoryLabel(category: Offer["category"]) {
  switch (category) {
    case "reviews_reputation":
      return "Reviews / Reputation";
    case "naps":
      return "NAPS";
  }

  return formatLabel(category);
}

function formatPricingNotes(pricing: Offer["pricing"]) {
  if (!pricing) {
    return "No structured pricing is configured in seed data yet.";
  }

  const parts: string[] = [];

  if (pricing.setup) {
    const label = pricing.setup.label ?? "Setup";
    parts.push(`${label}: ${currencyFormatter.format(pricing.setup.amountUsd)}`);
  }

  if (pricing.recurring) {
    const cadence =
      pricing.recurring.cadence === "monthly" ? "/mo" : " one-time";
    const label = pricing.recurring.label ?? "Recurring";
    parts.push(
      `${label}: ${currencyFormatter.format(pricing.recurring.amountUsd)}${cadence}`,
    );
  }

  return parts.join(" • ");
}

function formatWorkflowRoleLabel(role: WorkflowChannelConfiguration["role"]) {
  switch (role) {
    case "primary":
      return "Primary operating lane";
    case "supporting":
      return "Supporting operator lane";
    case "future":
      return "Future workflow lane";
  }

  return formatLabel(role);
}

function formatApprovalModeLabel(mode: WorkflowApprovalMode) {
  switch (mode) {
    case "operator_required":
      return "Operator approval required";
    case "operator_review":
      return "Operator review required";
    case "recommendation_only":
      return "Recommendation only";
  }

  return formatLabel(mode);
}

function formatMemoryEntryKindLabel(kind: MemoryEntryKind) {
  switch (kind) {
    case "system_learning":
      return "System learning";
    case "operator_note":
      return "Operator note";
    case "playbook":
      return "Playbook";
    case "constraint":
      return "Constraint";
  }

  return formatLabel(kind);
}

function getIcpStatusBadge(profile: IcpProfile): SelectorBadge {
  switch (profile.id) {
    case "icp_primary_used_car_dealer":
      return { label: "Primary ICP", tone: "success" };
    case "icp_secondary_used_car_dealer":
      return { label: "Secondary ICP", tone: "accent" };
  }

  return { label: "Configured ICP", tone: "neutral" };
}

function getOfferStatusBadge(
  activeCampaignCount: number,
  configuredCount: number,
): SelectorBadge {
  if (activeCampaignCount > 0) {
    return { label: "Active", tone: "success" };
  }

  if (configuredCount > 0) {
    return { label: "Configured", tone: "accent" };
  }

  return { label: "Inactive", tone: "muted" };
}

function getWorkflowStatusBadge(status: WorkflowChannelStatus): SelectorBadge {
  switch (status) {
    case "configured":
      return { label: "Configured", tone: "success" };
    case "operator_assisted":
      return { label: "Operator assisted", tone: "accent" };
    case "planned":
      return { label: "Planned", tone: "warning" };
  }

  return { label: "Unknown", tone: "neutral" };
}

function getLearningStatusBadge(
  status: LearningTrackingStatus,
): SelectorBadge {
  switch (status) {
    case "mock_ready":
      return { label: "Mock ready", tone: "accent" };
    case "planned":
      return { label: "Planned", tone: "warning" };
  }

  return { label: "Unknown", tone: "neutral" };
}

function getIntegrationStatusBadge(
  status: IntegrationReadinessStatus,
): SelectorBadge {
  switch (status) {
    case "mock_ready":
      return { label: "Mock ready", tone: "accent" };
    case "pending":
      return { label: "Pending", tone: "warning" };
    case "planned":
      return { label: "Planned", tone: "muted" };
  }

  return { label: "Unknown", tone: "neutral" };
}

function getOfferUsageCounts(offerId: Offer["id"]) {
  const campaigns = dataAccess
    .campaigns
    .list()
    .filter((campaign) => campaign.offerId === offerId);
  const sequences = dataAccess
    .sequences
    .list()
    .filter((sequence) => sequence.offerId === offerId);

  return {
    activeCampaignCount: campaigns.filter((campaign) => campaign.status === "active")
      .length,
    configuredCount:
      campaigns.filter((campaign) => campaign.status === "draft").length +
      sequences.filter(
        (sequence) => sequence.status === "active" || sequence.status === "draft",
      ).length,
  };
}

function formatOfferRoleLabel(offer: Offer) {
  if (offer.isPrimaryFrontDoor) {
    return "First-offer / front-door wedge";
  }

  if (offer.timing === "later_offer") {
    return "Later-offer / expansion path";
  }

  return "Supporting offer";
}

function formatOfferUsageLabel(offer: Offer) {
  const counts = getOfferUsageCounts(offer.id);
  const campaignCount = dataAccess
    .campaigns
    .list()
    .filter((campaign) => campaign.offerId === offer.id).length;
  const sequenceCount = dataAccess
    .sequences
    .list()
    .filter((sequence) => sequence.offerId === offer.id).length;

  if (campaignCount === 0 && sequenceCount === 0) {
    return "Not referenced by campaigns or sequences yet.";
  }

  return `${counts.activeCampaignCount} active ${pluralize(
    "campaign",
    counts.activeCampaignCount,
  )} • ${sequenceCount} configured ${pluralize("sequence", sequenceCount)}`;
}

function formatScoreRangeLabel(definition: PriorityTierDefinition) {
  return `${definition.scoreRange.min}-${definition.scoreRange.max}`;
}

function getScoringBucket(definition: PriorityTierDefinition) {
  return scoringBuckets.find(
    (bucket) =>
      bucket.minScore === definition.scoreRange.min &&
      bucket.maxScore === definition.scoreRange.max,
  );
}

function getRoutingNote(definition: PriorityTierDefinition) {
  switch (definition.tier) {
    case "tier_1":
      return "Route into fast operator review, validate the decision-maker, and prioritize campaign-ready enrollment work.";
    case "tier_2":
      return "Keep active in the working queue with lighter personalization and a slower review cadence behind Tier 1.";
    case "tier_3":
      return "Suppress from early workflow attention until stronger fit, timing, or contact signals appear.";
  }

  return "No routing note configured.";
}

function getWorkflowUsageLabel(configuration: WorkflowChannelConfiguration) {
  switch (configuration.key) {
    case "email": {
      const activeCampaigns = dataAccess.campaigns.listByStatus("active").length;
      const activeSequences = dataAccess.sequences.listByStatus("active").length;

      return `${activeCampaigns} active ${pluralize(
        "campaign",
        activeCampaigns,
      )} • ${activeSequences} active ${pluralize("sequence", activeSequences)}`;
    }
    case "manual_research_follow_up": {
      const supportedTiers = priorityTierDefinitions.filter((definition) =>
        definition.recommendedChannels.includes("manual research follow-up"),
      ).length;

      return `${supportedTiers} scoring ${pluralize("tier", supportedTiers)} recommends this assist lane`;
    }
    case "linkedin_workflow":
      return "0 live workflows • policy and provider still undecided";
  }
}

function getCurrentOutcomeSignal(outcome: LearningOutcomeConfiguration) {
  switch (outcome.key) {
    case "appointments_booked": {
      const appointmentCount = dataAccess
        .appointments
        .list()
        .filter(
          (appointment) =>
            appointment.status === "scheduled" ||
            appointment.status === "completed",
        ).length;

      return `${appointmentCount} scheduled or completed ${pluralize(
        "appointment",
        appointmentCount,
      )}`;
    }
    case "positive_replies": {
      const positiveReplies = dataAccess.replies.listByClassification("positive")
        .length;

      return `${positiveReplies} positive ${pluralize("reply", positiveReplies)}`;
    }
    case "objection_patterns": {
      const patternCount = dataAccess
        .replies
        .list()
        .filter(
          (reply) =>
            reply.classification === "objection" ||
            reply.classification === "not_now" ||
            reply.classification === "wrong_person",
        ).length;

      return `${patternCount} objection or timing ${pluralize(
        "signal",
        patternCount,
      )}`;
    }
    case "operator_review_gates": {
      const constraints = dataAccess
        .memoryEntries
        .list()
        .filter((entry) => entry.kind === "constraint").length;
      const flaggedReplies = dataAccess
        .replies
        .list()
        .filter((reply) => reply.requiresHumanReview).length;

      return `${constraints} constraint ${pluralize(
        "entry",
        constraints,
      )} • ${flaggedReplies} flagged ${pluralize("reply", flaggedReplies)}`;
    }
  }

  return "No current signal configured.";
}

function getMemoryCategorySummary(kind: MemoryEntryKind) {
  switch (kind) {
    case "system_learning":
      return "Durable patterns the system should eventually promote into reusable knowledge.";
    case "operator_note":
      return "Human notes captured during review, qualification, or follow-up decision-making.";
    case "playbook":
      return "Stable execution guidance such as email-first or offer-positioning rules.";
    case "constraint":
      return "Guardrails that block automation, restarts, or unsafe recommendations until review.";
  }

  return "No summary configured.";
}

function getStats(
  offerConfigurations: SettingsOfferConfigurationView[],
  workflowConfigurations: SettingsWorkflowConfigurationView[],
  integrationReadiness: SettingsIntegrationReadinessView[],
): WorkspaceStat[] {
  const activeOffers = offerConfigurations.filter(
    (configuration) => configuration.statusBadge.label !== "Inactive",
  ).length;
  const configuredChannels = workflowConfigurations.filter(
    (configuration) => configuration.configuration.status !== "planned",
  ).length;
  const readyIntegrations = integrationReadiness.filter(
    (integration) => integration.check.status === "mock_ready",
  ).length;
  const pendingIntegrations = integrationReadiness.length - readyIntegrations;

  return [
    {
      label: "Active ICPs",
      value: String(initialIcpProfiles.length),
      change: "Primary + secondary",
      detail:
        "Current ICP coverage is concentrated on independent used-car dealers with a primary dream-fit and a secondary working lane.",
      tone: "positive",
    },
    {
      label: "Active offers",
      value: String(activeOffers),
      change: "Front door + later",
      detail:
        "Seeded offers are already referenced by typed campaign and sequence records, so the settings view reflects real mock operations.",
      tone: "positive",
    },
    {
      label: "Scoring tiers",
      value: String(priorityTierDefinitions.length),
      change: "High / medium / low",
      detail:
        "Priority tiers and scoring buckets stay aligned so routing, offer fit, and queue handling share one control surface.",
      tone: "neutral",
    },
    {
      label: "Configured channels",
      value: String(configuredChannels),
      change: "Email + research",
      detail:
        "Email is the primary configured lane, with manual research follow-up modeled as a supporting operator workflow and LinkedIn still planned.",
      tone: "neutral",
    },
    {
      label: "Mock integrations ready / pending",
      value: `${readyIntegrations} / ${pendingIntegrations}`,
      change: "Ready / pending",
      detail:
        "Provider readiness is represented as control-plane status only, with no live secrets, external calls, or autonomous execution wired in.",
      tone: "warning",
    },
  ];
}

function getIcpConfigurations(): SettingsIcpConfigurationView[] {
  return initialIcpProfiles.map((profile) => {
    const configuration = icpControlById.get(profile.id);
    const firstOffer = configuration
      ? offerByCategory.get(configuration.firstOfferCategory)
      : undefined;

    return {
      profile,
      statusBadge: getIcpStatusBadge(profile),
      targetIndustriesLabel:
        configuration?.targetIndustries.join(" • ") ?? profile.market,
      targetSubindustriesLabel:
        configuration?.targetSubindustries.join(" • ") ?? "Not configured yet",
      preferredChannelLabels:
        configuration?.preferredChannels.map((channel) => formatLabel(channel)) ?? [],
      dreamSummary: configuration?.dreamSummary ?? profile.summary,
      tierTwoSummary: configuration?.tierTwoSummary ?? profile.summary,
      avoidSummary:
        configuration?.avoidSummary ??
        profile.disqualifiers.join(" • ") ??
        "No avoid guidance configured yet.",
      firstOfferName: firstOffer?.name ?? "Offer pending",
      firstOfferCategoryLabel: configuration
        ? formatOfferCategoryLabel(configuration.firstOfferCategory)
        : "Not configured",
    };
  });
}

function getOfferConfigurations(): SettingsOfferConfigurationView[] {
  return initialOffers.map((offer) => {
    const usageCounts = getOfferUsageCounts(offer.id);

    return {
      offer,
      statusBadge: getOfferStatusBadge(
        usageCounts.activeCampaignCount,
        usageCounts.configuredCount,
      ),
      categoryLabel: formatOfferCategoryLabel(offer.category),
      roleLabel: formatOfferRoleLabel(offer),
      usageLabel: formatOfferUsageLabel(offer),
      pricingNotes: formatPricingNotes(offer.pricing),
      ctaGuidance: offer.primaryCta,
    };
  });
}

function getScoringConfigurations(): SettingsScoringConfigurationView[] {
  return priorityTierDefinitions.map((definition) => ({
    definition,
    scoringBucket: getScoringBucket(definition),
    priorityBadge: getPriorityBadge(definition.tier),
    recommendedChannelsLabel: definition.recommendedChannels
      .map((channel) => formatLabel(channel))
      .join(" • "),
    recommendedOfferLabel: formatOfferCategoryLabel(
      definition.recommendedOfferCategory,
    ),
    scoreRangeLabel: formatScoreRangeLabel(definition),
    routingNote: getRoutingNote(definition),
  }));
}

function getWorkflowConfigurations(): SettingsWorkflowConfigurationView[] {
  return workflowChannelConfigurations.map((configuration) => ({
    configuration,
    statusBadge: getWorkflowStatusBadge(configuration.status),
    roleLabel: formatWorkflowRoleLabel(configuration.role),
    approvalModeLabel: formatApprovalModeLabel(configuration.approvalMode),
    usageLabel: getWorkflowUsageLabel(configuration),
  }));
}

function getLearningView(): SettingsLearningView {
  const entries = dataAccess.memoryEntries.list();

  return {
    configuration: learningConfiguration,
    outcomes: learningConfiguration.trackedOutcomes.map((configuration) => ({
      configuration,
      statusBadge: getLearningStatusBadge(configuration.trackingStatus),
      currentSignalLabel: getCurrentOutcomeSignal(configuration),
    })),
    memoryCategories: learningConfiguration.memoryEntryCategories.map((kind) => {
      const count = entries.filter((entry) => entry.kind === kind).length;

      return {
        kind,
        label: formatMemoryEntryKindLabel(kind),
        countLabel: `${count} ${pluralize("entry", count)}`,
        summary: getMemoryCategorySummary(kind),
      };
    }),
  };
}

function getIntegrationReadiness(): SettingsIntegrationReadinessView[] {
  const statusOrder: Record<IntegrationReadinessStatus, number> = {
    mock_ready: 0,
    pending: 1,
    planned: 2,
  };

  return [...integrationReadinessChecks]
    .sort((left, right) => statusOrder[left.status] - statusOrder[right.status])
    .map((check) => ({
      check,
      statusBadge: getIntegrationStatusBadge(check.status),
    }));
}

export function getSettingsWorkspaceView(): SettingsWorkspaceView {
  const offerConfigurations = getOfferConfigurations();
  const workflowConfigurations = getWorkflowConfigurations();
  const integrationReadiness = getIntegrationReadiness();

  return {
    stats: getStats(
      offerConfigurations,
      workflowConfigurations,
      integrationReadiness,
    ),
    icpConfigurations: getIcpConfigurations(),
    offerConfigurations,
    scoringConfigurations: getScoringConfigurations(),
    workflowConfigurations,
    learning: getLearningView(),
    integrationReadiness,
  };
}
