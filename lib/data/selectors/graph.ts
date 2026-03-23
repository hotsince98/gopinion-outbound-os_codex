import {
  cleanQuery,
  type CompanyBundle,
  getCompanyStatusBadge,
  getDecisionMakerLabel,
  getIcpLabel,
  getPriorityBadge,
  getRecommendedOfferName,
  getReviewSnapshot,
  getSuggestedNextAction,
  listCompanyBundles,
  readSearchParam,
  type FilterOption,
  type SearchParamsInput,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
import {
  buildIdMap,
  getSelectorDataSnapshot,
  type SelectorDataSnapshot,
} from "@/lib/data/selectors/snapshot";
import type {
  Appointment,
  Campaign,
  Company,
  Contact,
  Enrollment,
  Insight,
  Offer,
} from "@/lib/domain";
export type GraphNodeType =
  | "company"
  | "contact"
  | "campaign"
  | "offer"
  | "appointment"
  | "insight";

export type GraphRelationshipType =
  | "company_contact"
  | "company_campaign"
  | "company_offer"
  | "company_appointment"
  | "campaign_insight";

interface GraphNodeRecord {
  id: string;
  type: GraphNodeType;
  title: string;
  subtitle: string;
  statusValue: string;
  statusBadge: SelectorBadge;
  metrics: string[];
  searchText: string;
  relationCount?: number;
}

interface GraphEdgeRecord {
  id: string;
  type: GraphRelationshipType;
  sourceId: string;
  targetId: string;
  label: string;
  summary: string;
}

interface GraphNodeGroup {
  type: GraphNodeType;
  label: string;
  count: number;
  nodes: GraphNodeRecord[];
}

interface GraphSelectorContext {
  snapshot: SelectorDataSnapshot;
  companyBundles: CompanyBundle[];
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  offerById: Map<string, Offer>;
  campaignById: Map<string, Campaign>;
  appointmentById: Map<string, Appointment>;
  insightById: Map<string, Insight>;
  enrollmentById: Map<string, Enrollment>;
}

export interface GraphRelationshipToggle {
  key: RelationshipToggleKey;
  label: string;
  count: number;
  enabled: boolean;
}

export interface GraphNodeDetailView {
  id: string;
  type: GraphNodeType;
  title: string;
  subtitle: string;
  statusBadge: SelectorBadge;
  nextAction: string;
  basics: Array<{ label: string; value: string }>;
  relatedRecords: Array<{ label: string; value: string }>;
  notes: string[];
}

export interface GraphRelationshipView {
  id: string;
  type: GraphRelationshipType;
  label: string;
  sourceTitle: string;
  targetTitle: string;
  summary: string;
}

export interface GraphWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: {
      q: string;
      nodeType: string;
      status: string;
      toggles: Record<RelationshipToggleKey, boolean>;
    };
    nodeTypeOptions: FilterOption[];
    statusOptions: FilterOption[];
    relationshipToggles: GraphRelationshipToggle[];
  };
  groups: GraphNodeGroup[];
  relationships: GraphRelationshipView[];
  selectedNode?: GraphNodeDetailView;
  query: Record<string, string>;
  resultLabel: string;
  hasActiveFilters: boolean;
  emptyState: {
    title: string;
    description: string;
  };
}

type RelationshipToggleKey =
  | "showCompanyContact"
  | "showCompanyCampaign"
  | "showCompanyOffer"
  | "showCompanyAppointment"
  | "showCampaignInsight";

const nodeTypeLabels: Record<GraphNodeType, string> = {
  company: "Companies",
  contact: "Contacts",
  campaign: "Campaigns",
  offer: "Offers",
  appointment: "Appointments",
  insight: "Insights",
};

const relationshipToggleConfig: Array<{
  key: RelationshipToggleKey;
  type: GraphRelationshipType;
  label: string;
}> = [
  {
    key: "showCompanyContact",
    type: "company_contact",
    label: "Company → Contact",
  },
  {
    key: "showCompanyCampaign",
    type: "company_campaign",
    label: "Company → Campaign",
  },
  {
    key: "showCompanyOffer",
    type: "company_offer",
    label: "Company → Offer",
  },
  {
    key: "showCompanyAppointment",
    type: "company_appointment",
    label: "Company → Appointment",
  },
  {
    key: "showCampaignInsight",
    type: "campaign_insight",
    label: "Campaign → Insight",
  },
];

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildGraphSelectorContext(
  snapshot: SelectorDataSnapshot,
): GraphSelectorContext {
  return {
    snapshot,
    companyBundles: listCompanyBundles(snapshot),
    companyById: buildIdMap(snapshot.companies),
    contactById: buildIdMap(snapshot.contacts),
    offerById: buildIdMap(snapshot.offers),
    campaignById: buildIdMap(snapshot.campaigns),
    appointmentById: buildIdMap(snapshot.appointments),
    insightById: buildIdMap(snapshot.insights),
    enrollmentById: buildIdMap(snapshot.enrollments),
  };
}

function getContactStatusBadge(contact: Contact): SelectorBadge {
  switch (contact.status) {
    case "verified":
      return { label: "Verified", tone: "success" };
    case "candidate":
      return { label: "Candidate", tone: "accent" };
    case "invalid":
    case "do_not_contact":
      return { label: humanize(contact.status), tone: "danger" };
  }
}

function getCampaignStatusBadge(campaign: Campaign): SelectorBadge {
  switch (campaign.status) {
    case "active":
      return { label: "Active", tone: "success" };
    case "draft":
      return { label: "Draft", tone: "warning" };
    case "paused":
      return { label: "Paused", tone: "warning" };
    case "completed":
      return { label: "Completed", tone: "accent" };
    case "archived":
      return { label: "Archived", tone: "muted" };
  }
}

function getOfferBadge(offer: Offer): SelectorBadge {
  return offer.isPrimaryFrontDoor
    ? { label: "Front door", tone: "success" }
    : { label: "Later offer", tone: "accent" };
}

function getAppointmentBadge(appointment: Appointment): SelectorBadge {
  switch (appointment.status) {
    case "scheduled":
      return { label: "Scheduled", tone: "success" };
    case "proposed":
      return { label: "Proposed", tone: "warning" };
    case "completed":
      return { label: "Completed", tone: "accent" };
    case "canceled":
    case "no_show":
      return { label: humanize(appointment.status), tone: "danger" };
  }
}

function getInsightBadge(insight: Insight): SelectorBadge {
  switch (insight.type) {
    case "campaign_performance":
      return { label: "Performance", tone: "success" };
    case "scope":
      return { label: "Scope", tone: "warning" };
    case "offer_fit":
    case "decision_maker":
    case "reply_pattern":
    case "icp_signal":
      return { label: humanize(insight.type), tone: "accent" };
  }
}

function getCompanyNodes(context: GraphSelectorContext) {
  return context.companyBundles.map((bundle) => ({
    id: bundle.company.id,
    type: "company" as const,
    title: bundle.company.name,
    subtitle: `${bundle.company.location.city}, ${bundle.company.location.state}`,
    statusValue: bundle.company.status,
    statusBadge: getCompanyStatusBadge(bundle.company.status),
    metrics: [
      getReviewSnapshot(bundle.company),
      getRecommendedOfferName(bundle),
      getDecisionMakerLabel(bundle),
    ],
    searchText: [
      bundle.company.name,
      bundle.company.location.city,
      bundle.company.location.state,
      getIcpLabel(bundle.company),
      getRecommendedOfferName(bundle),
    ]
      .join(" ")
      .toLowerCase(),
  }));
}

function getContactNodes(context: GraphSelectorContext) {
  return context.snapshot.contacts.map((contact) => {
    const company = context.companyById.get(contact.companyId);

    return {
      id: contact.id,
      type: "contact" as const,
      title: contact.fullName ?? "Unnamed contact",
      subtitle: company?.name ?? "Unlinked company",
      statusValue: contact.status,
      statusBadge: getContactStatusBadge(contact),
      metrics: [
        contact.title ?? humanize(contact.role),
        `Confidence ${contact.confidence.score.toFixed(2)}`,
        humanize(contact.sourceKind),
      ],
      searchText: [
        contact.fullName ?? "",
        contact.title ?? contact.role,
        company?.name ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

function getCampaignNodes(context: GraphSelectorContext) {
  return context.snapshot.campaigns.map((campaign) => {
    const offer = context.offerById.get(campaign.offerId);
    const enrolledCount = context.snapshot.enrollments.filter(
      (enrollment) => enrollment.campaignId === campaign.id,
    ).length;

    return {
      id: campaign.id,
      type: "campaign" as const,
      title: campaign.name,
      subtitle: offer?.name ?? "Offer pending",
      statusValue: campaign.status,
      statusBadge: getCampaignStatusBadge(campaign),
      metrics: [
        humanize(campaign.targetTier),
        `${enrolledCount} enrollments`,
        campaign.channel,
      ],
      searchText: [campaign.name, campaign.description, offer?.name ?? ""]
        .join(" ")
        .toLowerCase(),
    };
  });
}

function getOfferNodes(context: GraphSelectorContext) {
  return context.snapshot.offers.map((offer) => {
    const campaignCount = context.snapshot.campaigns.filter(
      (campaign) => campaign.offerId === offer.id,
    ).length;

    return {
      id: offer.id,
      type: "offer" as const,
      title: offer.name,
      subtitle: humanize(offer.category),
      statusValue: offer.timing,
      statusBadge: getOfferBadge(offer),
      metrics: [offer.problemSolved, `${campaignCount} campaigns`, offer.primaryCta],
      searchText: [offer.name, offer.description, offer.problemSolved]
        .join(" ")
        .toLowerCase(),
    };
  });
}

function getAppointmentNodes(context: GraphSelectorContext) {
  return context.snapshot.appointments.map((appointment) => {
    const company = context.companyById.get(appointment.companyId);

    return {
      id: appointment.id,
      type: "appointment" as const,
      title: company?.name ?? "Scheduled appointment",
      subtitle: formatShortDate(appointment.scheduledFor),
      statusValue: appointment.status,
      statusBadge: getAppointmentBadge(appointment),
      metrics: [
        appointment.timezone,
        `Campaign ${appointment.campaignId.replace("campaign_", "")}`,
        appointment.notes ?? "No notes",
      ],
      searchText: [
        company?.name ?? "",
        appointment.timezone,
        appointment.notes ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

function getInsightNodes(context: GraphSelectorContext) {
  return context.snapshot.insights.map((insight) => ({
    id: insight.id,
    type: "insight" as const,
    title: insight.title,
    subtitle: humanize(insight.type),
    statusValue: insight.type,
    statusBadge: getInsightBadge(insight),
    metrics: [
      `Confidence ${insight.confidence.toFixed(2)}`,
      `${insight.tags.length} tags`,
      insight.summary,
    ],
    searchText: [insight.title, insight.summary, insight.tags.join(" ")]
      .join(" ")
      .toLowerCase(),
  }));
}

function buildNodes(context: GraphSelectorContext) {
  return [
    ...getCompanyNodes(context),
    ...getContactNodes(context),
    ...getCampaignNodes(context),
    ...getOfferNodes(context),
    ...getAppointmentNodes(context),
    ...getInsightNodes(context),
  ];
}

function buildEdges(context: GraphSelectorContext) {
  const edges: GraphEdgeRecord[] = [];

  for (const bundle of context.companyBundles) {
    for (const contact of bundle.contacts) {
      edges.push({
        id: `${bundle.company.id}:${contact.id}`,
        type: "company_contact",
        sourceId: bundle.company.id,
        targetId: contact.id,
        label: "Company → Contact",
        summary: `${bundle.company.name} is linked to ${contact.fullName ?? humanize(contact.role)}.`,
      });
    }

    for (const campaign of bundle.activeCampaigns) {
      edges.push({
        id: `${bundle.company.id}:${campaign.id}`,
        type: "company_campaign",
        sourceId: bundle.company.id,
        targetId: campaign.id,
        label: "Company → Campaign",
        summary: `${bundle.company.name} is active in ${campaign.name}.`,
      });
    }

    if (bundle.recommendedOffer) {
      edges.push({
        id: `${bundle.company.id}:${bundle.recommendedOffer.id}`,
        type: "company_offer",
        sourceId: bundle.company.id,
        targetId: bundle.recommendedOffer.id,
        label: "Company → Offer",
        summary: `${bundle.company.name} currently points to ${bundle.recommendedOffer.name}.`,
      });
    }

    for (const appointment of bundle.appointments) {
      edges.push({
        id: `${bundle.company.id}:${appointment.id}`,
        type: "company_appointment",
        sourceId: bundle.company.id,
        targetId: appointment.id,
        label: "Company → Appointment",
        summary: `${bundle.company.name} has an appointment scheduled for ${formatShortDate(
          appointment.scheduledFor,
        )}.`,
      });
    }
  }

  for (const campaign of context.snapshot.campaigns) {
    const insights = context.snapshot.insights.filter(
      (insight) =>
        insight.sourceEntityType === "campaign" &&
        insight.sourceEntityId === campaign.id,
    );

    for (const insight of insights) {
      edges.push({
        id: `${campaign.id}:${insight.id}`,
        type: "campaign_insight",
        sourceId: campaign.id,
        targetId: insight.id,
        label: "Campaign → Insight",
        summary: `${campaign.name} generated the insight "${insight.title}".`,
      });
    }
  }

  return edges;
}

function getNodeTypeOptions(nodes: GraphNodeRecord[]): FilterOption[] {
  const items: Array<{ value: string; label: string }> = [
    { value: "all", label: "All node types" },
    ...Object.entries(nodeTypeLabels).map(([value, label]) => ({ value, label })),
  ];

  return items.map((item) => ({
    ...item,
    count:
      item.value === "all"
        ? nodes.length
        : nodes.filter((node) => node.type === item.value).length,
  }));
}

function getStatusOptions(
  nodes: GraphNodeRecord[],
  nodeType: string,
): FilterOption[] {
  const scopedNodes =
    nodeType === "all"
      ? nodes
      : nodes.filter((node) => node.type === nodeType);

  const statuses = Array.from(
    new Map(
      scopedNodes.map((node) => [
        node.statusValue,
        { value: node.statusValue, label: node.statusBadge.label },
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));

  return [
    {
      value: "all",
      label: "All statuses / states",
      count: scopedNodes.length,
    },
    ...statuses.map((status) => ({
      ...status,
      count: scopedNodes.filter((node) => node.statusValue === status.value).length,
    })),
  ];
}

function getRelationshipToggles(
  edges: GraphEdgeRecord[],
  toggles: Record<RelationshipToggleKey, boolean>,
): GraphRelationshipToggle[] {
  return relationshipToggleConfig.map((config) => ({
    key: config.key,
    label: config.label,
    count: edges.filter((edge) => edge.type === config.type).length,
    enabled: toggles[config.key],
  }));
}

function getSelectedEdgeTypes(
  searchParams: SearchParamsInput,
): Record<RelationshipToggleKey, boolean> {
  const hasExplicitToggles = relationshipToggleConfig.some(
    (config) => searchParams[config.key] !== undefined,
  );

  return Object.fromEntries(
    relationshipToggleConfig.map((config) => [
      config.key,
      hasExplicitToggles
        ? readSearchParam(searchParams[config.key]) === "1"
        : true,
    ]),
  ) as Record<RelationshipToggleKey, boolean>;
}

function isEdgeEnabled(
  edge: GraphEdgeRecord,
  toggles: Record<RelationshipToggleKey, boolean>,
) {
  const config = relationshipToggleConfig.find((item) => item.type === edge.type);

  return config ? toggles[config.key] : true;
}

function getConnectedNodeIds(edges: GraphEdgeRecord[], nodeIds: Set<string>) {
  const relatedIds = new Set<string>(nodeIds);

  for (const edge of edges) {
    if (nodeIds.has(edge.sourceId) || nodeIds.has(edge.targetId)) {
      relatedIds.add(edge.sourceId);
      relatedIds.add(edge.targetId);
    }
  }

  return relatedIds;
}

function getNodeDetail(
  node: GraphNodeRecord,
  edges: GraphEdgeRecord[],
  context: GraphSelectorContext,
): GraphNodeDetailView | undefined {
  const relatedEdges = edges.filter(
    (edge) => edge.sourceId === node.id || edge.targetId === node.id,
  );

  if (node.type === "company") {
    const bundle = context.companyBundles.find(
      (candidate) => candidate.company.id === node.id,
    );
    if (!bundle) {
      return undefined;
    }

    return {
      id: node.id,
      type: node.type,
      title: bundle.company.name,
      subtitle: `${bundle.company.location.city}, ${bundle.company.location.state}`,
      statusBadge: node.statusBadge,
      nextAction: getSuggestedNextAction(bundle),
      basics: [
        { label: "ICP", value: getIcpLabel(bundle.company) },
        {
          label: "Priority",
          value: getPriorityBadge(bundle.company.priorityTier).label,
        },
        { label: "Review profile", value: getReviewSnapshot(bundle.company) },
        {
          label: "Decision-maker",
          value: getDecisionMakerLabel(bundle),
        },
      ],
      relatedRecords: [
        { label: "Contacts", value: String(bundle.contacts.length) },
        { label: "Campaigns", value: String(bundle.activeCampaigns.length) },
        {
          label: "Recommended offer",
          value: getRecommendedOfferName(bundle),
        },
        { label: "Appointments", value: String(bundle.appointments.length) },
      ],
      notes: [
        ...bundle.company.painSignals,
        ...bundle.company.scoring.reasons,
      ],
    };
  }

  if (node.type === "contact") {
    const contact = context.contactById.get(node.id as Contact["id"]);
    if (!contact) {
      return undefined;
    }
    const company = context.companyById.get(contact.companyId);
    const bundle = context.companyBundles.find(
      (candidate) => candidate.company.id === company?.id,
    );

    return {
      id: node.id,
      type: node.type,
      title: contact.fullName ?? "Unnamed contact",
      subtitle: company?.name ?? "Unlinked company",
      statusBadge: node.statusBadge,
      nextAction:
        contact.status === "candidate"
          ? "Verify this contact before relying on it for outreach."
          : "Use this contact in campaign planning and message review.",
      basics: [
        { label: "Role", value: contact.title ?? humanize(contact.role) },
        { label: "Confidence", value: `Confidence ${contact.confidence.score.toFixed(2)}` },
        { label: "Source", value: contact.source.provider },
        { label: "Kind", value: humanize(contact.sourceKind) },
      ],
      relatedRecords: [
        { label: "Company", value: company?.name ?? "Unknown company" },
        {
          label: "Recommended offer",
          value: bundle ? getRecommendedOfferName(bundle) : "Offer pending",
        },
        {
          label: "Active campaigns",
          value: bundle ? String(bundle.activeCampaigns.length) : "0",
        },
        { label: "Relationships", value: String(relatedEdges.length) },
      ],
      notes: contact.notes.length > 0 ? contact.notes : contact.confidence.signals,
    };
  }

  if (node.type === "campaign") {
    const campaign = context.campaignById.get(node.id as Campaign["id"]);
    if (!campaign) {
      return undefined;
    }
    const offer = context.offerById.get(campaign.offerId);
    const companies = context.companyBundles.filter((bundle) =>
      bundle.activeCampaigns.some((candidate) => candidate.id === campaign.id),
    );
    const insights = context.snapshot.insights.filter(
      (insight) =>
        insight.sourceEntityType === "campaign" &&
        insight.sourceEntityId === campaign.id,
    );
    const enrollments = context.snapshot.enrollments.filter(
      (enrollment) => enrollment.campaignId === campaign.id,
    );

    return {
      id: node.id,
      type: node.type,
      title: campaign.name,
      subtitle: offer?.name ?? "Offer pending",
      statusBadge: node.statusBadge,
      nextAction:
        campaign.status === "active"
          ? "Use connected insights to tune messaging and decide where to expand next."
          : "Review whether this campaign should move back into active rotation.",
      basics: [
        { label: "Objective", value: campaign.objective },
        { label: "Target tier", value: humanize(campaign.targetTier) },
        { label: "Channel", value: humanize(campaign.channel) },
        { label: "Offer", value: offer?.name ?? "Unknown offer" },
      ],
      relatedRecords: [
        { label: "Companies", value: String(companies.length) },
        { label: "Enrollments", value: String(enrollments.length) },
        { label: "Insights", value: String(insights.length) },
        {
          label: "Appointments",
          value: String(
            context.snapshot.appointments.filter(
              (appointment) => appointment.campaignId === campaign.id,
            ).length,
          ),
        },
      ],
      notes:
        insights.length > 0
          ? insights.map((insight) => insight.title)
          : [campaign.description],
    };
  }

  if (node.type === "offer") {
    const offer = context.offerById.get(node.id as Offer["id"]);
    if (!offer) {
      return undefined;
    }
    const companyCount = context.companyBundles.filter(
      (bundle) => bundle.recommendedOffer?.id === offer.id,
    ).length;
    const campaignCount = context.snapshot.campaigns.filter(
      (campaign) => campaign.offerId === offer.id,
    ).length;

    return {
      id: node.id,
      type: node.type,
      title: offer.name,
      subtitle: humanize(offer.category),
      statusBadge: node.statusBadge,
      nextAction: offer.isPrimaryFrontDoor
        ? "Keep this offer as the primary dealer wedge and route more qualified companies into it."
        : "Use this as a secondary path after stronger fit or trust signals appear.",
      basics: [
        { label: "Problem solved", value: offer.problemSolved },
        { label: "Timing", value: humanize(offer.timing) },
        { label: "CTA", value: offer.primaryCta },
        {
          label: "Pricing",
          value: offer.pricing?.setup
            ? `$${offer.pricing.setup.amountUsd} setup${offer.pricing.recurring ? ` • $${offer.pricing.recurring.amountUsd}/mo` : ""}`
            : "Pricing pending",
        },
      ],
      relatedRecords: [
        { label: "Recommended for companies", value: String(companyCount) },
        { label: "Campaigns using it", value: String(campaignCount) },
        { label: "Relationships", value: String(relatedEdges.length) },
        { label: "Category", value: humanize(offer.category) },
      ],
      notes: offer.fitSignals,
    };
  }

  if (node.type === "appointment") {
    const appointment = context.appointmentById.get(
      node.id as Appointment["id"],
    );
    if (!appointment) {
      return undefined;
    }
    const company = context.companyById.get(appointment.companyId);
    const contact = context.contactById.get(appointment.contactId);
    const campaign = context.campaignById.get(appointment.campaignId);

    return {
      id: node.id,
      type: node.type,
      title: company?.name ?? "Scheduled appointment",
      subtitle: formatShortDate(appointment.scheduledFor),
      statusBadge: node.statusBadge,
      nextAction:
        appointment.status === "scheduled"
          ? "Prepare the meeting around the visible dealer pain and recommended offer."
          : "Review the appointment outcome and feed it back into learning.",
      basics: [
        { label: "Scheduled for", value: formatShortDate(appointment.scheduledFor) },
        { label: "Timezone", value: appointment.timezone },
        { label: "Company", value: company?.name ?? "Unknown company" },
        { label: "Contact", value: contact?.fullName ?? "Unknown contact" },
      ],
      relatedRecords: [
        { label: "Campaign", value: campaign?.name ?? "Unknown campaign" },
        { label: "Status", value: humanize(appointment.status) },
        { label: "Relationships", value: String(relatedEdges.length) },
        { label: "Reply source", value: appointment.replyId },
      ],
      notes: appointment.notes ? [appointment.notes] : ["No appointment notes yet."],
    };
  }

  if (node.type === "insight") {
    const insight = context.insightById.get(node.id as Insight["id"]);
    if (!insight) {
      return undefined;
    }
    const source =
      insight.sourceEntityType === "campaign" && insight.sourceEntityId
        ? context.campaignById.get(insight.sourceEntityId as Campaign["id"])?.name ??
          insight.sourceEntityId
        : insight.sourceEntityId ?? "Unlinked";

    return {
      id: node.id,
      type: node.type,
      title: insight.title,
      subtitle: humanize(insight.type),
      statusBadge: node.statusBadge,
      nextAction:
        insight.type === "scope"
          ? "Use this insight to keep v1 scope disciplined."
          : "Apply this signal to targeting, messaging, or decision-maker routing.",
      basics: [
        { label: "Confidence", value: `Confidence ${insight.confidence.toFixed(2)}` },
        { label: "Type", value: humanize(insight.type) },
        { label: "Source entity", value: humanize(insight.sourceEntityType) },
        { label: "Source record", value: source },
      ],
      relatedRecords: [
        { label: "Tags", value: insight.tags.join(", ") || "None" },
        { label: "Relationships", value: String(relatedEdges.length) },
        { label: "Summary", value: insight.summary },
      ],
      notes: [insight.summary],
    };
  }

  return undefined;
}

export async function getGraphWorkspaceView(
  searchParams: SearchParamsInput,
): Promise<GraphWorkspaceView> {
  const q = readSearchParam(searchParams.q).trim();
  const nodeType = readSearchParam(searchParams.nodeType) || "all";
  const status = readSearchParam(searchParams.status) || "all";
  const nodeId = readSearchParam(searchParams.nodeId);
  const toggles = getSelectedEdgeTypes(searchParams);

  const context = buildGraphSelectorContext(await getSelectorDataSnapshot());
  const allNodes = buildNodes(context);
  const allEdges = buildEdges(context);
  const enabledEdges = allEdges.filter((edge) => isEdgeEnabled(edge, toggles));

  const baseNodes = allNodes.filter(
    (node) =>
      (nodeType === "all" || node.type === nodeType) &&
      (status === "all" || node.statusValue === status),
  );

  const visibleNodes =
    q.length > 0
      ? (() => {
          const matchedIds = new Set(
            baseNodes
              .filter((node) => node.searchText.includes(q.toLowerCase()))
              .map((node) => node.id),
          );
          const expandedIds = getConnectedNodeIds(enabledEdges, matchedIds);

          return baseNodes.filter((node) => expandedIds.has(node.id));
        })()
      : baseNodes;

  const visibleNodeIds = new Set<string>(visibleNodes.map((node) => node.id));
  const visibleEdges = enabledEdges.filter(
    (edge) =>
      visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
  );

  const relationCountByNode = new Map<string, number>();
  for (const edge of visibleEdges) {
    relationCountByNode.set(
      edge.sourceId,
      (relationCountByNode.get(edge.sourceId) ?? 0) + 1,
    );
    relationCountByNode.set(
      edge.targetId,
      (relationCountByNode.get(edge.targetId) ?? 0) + 1,
    );
  }

  const groups = Object.entries(nodeTypeLabels)
    .map(([type, label]) => ({
      type: type as GraphNodeType,
      label,
      nodes: visibleNodes.filter((node) => node.type === type),
    }))
    .filter((group) => group.nodes.length > 0 || nodeType === "all" || group.type === nodeType)
    .map((group) => ({
      ...group,
      count: group.nodes.length,
    }));

  const selectedNode =
    visibleNodes.find((node) => node.id === nodeId) ?? visibleNodes[0];

  const query = cleanQuery({
    q,
    nodeType: nodeType !== "all" ? nodeType : "",
    status: status !== "all" ? status : "",
    nodeId: selectedNode?.id ?? "",
    ...Object.fromEntries(
      relationshipToggleConfig.map((config) => [
        config.key,
        toggles[config.key] ? "1" : "",
      ]),
    ),
  });

  return {
    stats: [
      {
        label: "Visible nodes",
        value: String(visibleNodes.length),
        detail: "Typed records currently shown in the graph workspace.",
        change: `${allNodes.length} total`,
        tone: "neutral",
      },
      {
        label: "Visible relationships",
        value: String(visibleEdges.length),
        detail: "Active links between companies, contacts, campaigns, offers, appointments, and insights.",
        tone: "positive",
      },
      {
        label: "Companies in focus",
        value: String(visibleNodes.filter((node) => node.type === "company").length),
        detail: "Dealer accounts currently anchoring the graph view.",
        tone: "positive",
      },
      {
        label: "Scheduled appointments",
        value: String(
          visibleNodes.filter(
            (node) => node.type === "appointment" && node.statusValue === "scheduled",
          ).length,
        ),
        detail: "Meetings that keep the graph tied to the booking goal.",
        tone: "warning",
      },
    ],
    filters: {
      values: {
        q,
        nodeType,
        status,
        toggles,
      },
      nodeTypeOptions: getNodeTypeOptions(allNodes),
      statusOptions: getStatusOptions(allNodes, nodeType),
      relationshipToggles: getRelationshipToggles(allEdges, toggles),
    },
    groups: groups.map((group) => ({
      ...group,
      nodes: group.nodes.map((node) => ({
        ...node,
        relationCount: relationCountByNode.get(node.id) ?? 0,
      })),
    })),
    relationships: visibleEdges.slice(0, 18).map((edge) => {
      const sourceNode = allNodes.find((node) => node.id === edge.sourceId);
      const targetNode = allNodes.find((node) => node.id === edge.targetId);

      return {
        id: edge.id,
        type: edge.type,
        label: edge.label,
        sourceTitle: sourceNode?.title ?? edge.sourceId,
        targetTitle: targetNode?.title ?? edge.targetId,
        summary: edge.summary,
      };
    }),
    selectedNode: selectedNode
      ? getNodeDetail(selectedNode, visibleEdges, context)
      : undefined,
    query,
    resultLabel:
      visibleNodes.length === 1
        ? "1 node in view"
        : `${visibleNodes.length} nodes in view`,
    hasActiveFilters:
      Boolean(q) ||
      nodeType !== "all" ||
      status !== "all" ||
      Object.values(toggles).some((value) => !value),
    emptyState: {
      title: "No graph nodes match the current filters",
      description:
        "Try widening the node type, status, or relationship toggles to bring more of the outbound system back into view.",
    },
  };
}
