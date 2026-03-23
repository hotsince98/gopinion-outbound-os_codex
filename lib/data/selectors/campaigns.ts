import { initialIcpProfiles } from "@/lib/data/config/icp";
import {
  cleanQuery,
  formatPriorityLabel,
  makeCountedOptions,
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
  CampaignId,
  CampaignStatus,
  ChannelKind,
  Company,
  Contact,
  Enrollment,
  Experiment,
  IcpProfile,
  Insight,
  MemoryEntry,
  Offer,
  Reply,
  Sequence,
  SequenceId,
  SequenceStatus,
} from "@/lib/domain";

const icpById = new Map(initialIcpProfiles.map((profile) => [profile.id, profile]));

const campaignStatusOrder: Record<CampaignStatus, number> = {
  active: 0,
  paused: 1,
  draft: 2,
  completed: 3,
  archived: 4,
};

const sequenceStatusOrder: Record<SequenceStatus, number> = {
  active: 0,
  paused: 1,
  draft: 2,
  retired: 3,
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface CampaignRecord {
  campaign: Campaign;
  offer?: Offer;
  icpProfile?: IcpProfile;
  currentSequence?: Sequence;
  sequenceVersions: Sequence[];
  enrollments: Enrollment[];
  replies: Reply[];
  appointments: Appointment[];
  experiments: Experiment[];
  insights: Insight[];
  memoryEntries: MemoryEntry[];
}

interface CampaignSelectorContext {
  records: CampaignRecord[];
  offerById: Map<string, Offer>;
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  sequenceById: Map<string, Sequence>;
  sequences: Sequence[];
}

export interface CampaignsWorkspaceFilters {
  q: string;
  status: string;
  offer: string;
  icp: string;
  channel: string;
  campaignId: string;
}

export interface CampaignHealthStatusMetricsView {
  campaignId: string;
  statusBadge: SelectorBadge;
  healthBadge: SelectorBadge;
  totalEnrolled: number;
  active: number;
  waiting: number;
  replied: number;
  booked: number;
  paused: number;
  completed: number;
  failed: number;
  blockedOrNeedsReview: number;
  repliesReceived: number;
  positiveReplies: number;
  reviewRequired: number;
  bookedAppointments: number;
  replyRateLabel: string;
  bookedRateLabel: string;
  nextAction: string;
  nextActionAtLabel?: string;
}

interface CampaignHealthBaseMetrics {
  totalEnrolled: number;
  active: number;
  waiting: number;
  replied: number;
  booked: number;
  paused: number;
  completed: number;
  failed: number;
  blockedOrNeedsReview: number;
  repliesReceived: number;
  positiveReplies: number;
  reviewRequired: number;
  bookedAppointments: number;
  replyRateLabel: string;
  bookedRateLabel: string;
}

export interface CampaignListRowView {
  campaignId: string;
  campaignName: string;
  description: string;
  icpLabel: string;
  offerName: string;
  channelLabel: string;
  statusBadge: SelectorBadge;
  healthBadge: SelectorBadge;
  sequenceVersionLabel: string;
  enrollmentsLabel: string;
  repliesLabel: string;
  bookedAppointmentsLabel: string;
  nextAction: string;
  nextActionAtLabel?: string;
}

export interface CampaignSequenceStepView {
  id: string;
  stepNumber: number;
  stepType: string;
  subject: string;
  bodyPreview: string;
  delayLabel: string;
  goal: string;
  cta: string;
}

export interface CampaignSequenceVersionView {
  sequenceId: string;
  versionLabel: string;
  statusBadge: SelectorBadge;
  description: string;
  goal: string;
  isCurrent: boolean;
}

export interface CampaignSequenceSummaryView {
  sequenceId: string;
  name: string;
  versionLabel: string;
  stepCountLabel: string;
  audienceSummary: string;
  goal: string;
  offerName: string;
  targetTierLabel: string;
  statusBadge: SelectorBadge;
  steps: CampaignSequenceStepView[];
  versions: CampaignSequenceVersionView[];
}

export interface CampaignRecentReplyView {
  id: string;
  companyName: string;
  contactName: string;
  classificationLabel: string;
  classificationBadge: SelectorBadge;
  receivedAtLabel: string;
  snippet: string;
}

export interface CampaignDetailView {
  campaignId: string;
  campaignName: string;
  description: string;
  objective: string;
  statusBadges: SelectorBadge[];
  basics: Array<{ label: string; value: string }>;
  targeting: Array<{ label: string; value: string }>;
  enrollmentSummary: Array<{ label: string; value: string }>;
  replySummary: Array<{ label: string; value: string }>;
  appointmentSummary: Array<{ label: string; value: string }>;
  linkedSequence?: CampaignSequenceSummaryView;
  suggestedNextAction: string;
  readinessNotes: string[];
  experimentNotes: string[];
  recentReplies: CampaignRecentReplyView[];
}

export interface CampaignsWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: CampaignsWorkspaceFilters;
    statusOptions: FilterOption[];
    offerOptions: FilterOption[];
    icpOptions: FilterOption[];
    channelOptions: FilterOption[];
  };
  rows: CampaignListRowView[];
  selectedCampaign?: CampaignDetailView;
  query: Record<string, string>;
  hasActiveFilters: boolean;
  resultLabel: string;
  emptyState: {
    title: string;
    description: string;
  };
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function formatChannelLabel(channel: ChannelKind) {
  switch (channel) {
    case "email":
      return "Email";
  }
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return "0.0%";
  }

  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function getCampaignStatusBadge(status: CampaignStatus): SelectorBadge {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "accent" };
    case "active":
      return { label: "Active", tone: "success" };
    case "paused":
      return { label: "Paused", tone: "warning" };
    case "completed":
      return { label: "Completed", tone: "neutral" };
    case "archived":
      return { label: "Archived", tone: "muted" };
  }
}

function getSequenceStatusBadge(status: SequenceStatus): SelectorBadge {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "accent" };
    case "active":
      return { label: "Active", tone: "success" };
    case "paused":
      return { label: "Paused", tone: "warning" };
    case "retired":
      return { label: "Retired", tone: "muted" };
  }
}

function getReplyClassificationBadge(
  classification: Reply["classification"],
): SelectorBadge {
  switch (classification) {
    case "positive":
      return { label: "Positive", tone: "success" };
    case "objection":
      return { label: "Objection", tone: "warning" };
    case "not_now":
      return { label: "Not now", tone: "accent" };
    case "not_interested":
      return { label: "Not interested", tone: "danger" };
    case "wrong_person":
      return { label: "Wrong person", tone: "warning" };
    case "out_of_office":
      return { label: "OOO", tone: "muted" };
    case "bounced":
      return { label: "Bounced", tone: "danger" };
    case "unsubscribe":
      return { label: "Unsubscribe", tone: "danger" };
    case "unknown":
      return { label: "Unknown", tone: "muted" };
  }
}

function getHealthBadge(
  campaign: Campaign,
  metrics: CampaignHealthBaseMetrics,
): SelectorBadge {
  if (campaign.status === "draft") {
    return { label: "Needs QA", tone: "accent" };
  }

  if (metrics.reviewRequired > 0 || metrics.failed > 0) {
    return { label: "Needs review", tone: "warning" };
  }

  if (metrics.bookedAppointments > 0) {
    return { label: "Converting", tone: "success" };
  }

  if (metrics.active + metrics.waiting > 0) {
    return { label: "Running", tone: "accent" };
  }

  if (metrics.paused > 0 && metrics.totalEnrolled > 0) {
    return { label: "Paused", tone: "warning" };
  }

  if (metrics.totalEnrolled === 0 && campaign.status === "active") {
    return { label: "Needs enrollments", tone: "warning" };
  }

  if (metrics.completed > 0) {
    return { label: "Exhausted", tone: "muted" };
  }

  return { label: "Monitoring", tone: "neutral" };
}

function matchesSearch(record: CampaignRecord, search: string) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  const haystack = [
    record.campaign.name,
    record.campaign.description,
    record.campaign.objective,
    record.offer?.name ?? "",
    record.icpProfile?.name ?? "",
    record.currentSequence?.name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function buildCampaignSelectorContext(
  snapshot: SelectorDataSnapshot,
): CampaignSelectorContext {
  const offerById = buildIdMap(snapshot.offers);
  const companyById = buildIdMap(snapshot.companies);
  const contactById = buildIdMap(snapshot.contacts);
  const sequenceById = buildIdMap(snapshot.sequences);

  const records = snapshot.campaigns
    .map((campaign) => {
      const currentSequence = sequenceById.get(campaign.sequenceId);
      const sequenceVersions = currentSequence
        ? snapshot.sequences
            .filter((sequence) => sequence.lineageKey === currentSequence.lineageKey)
            .sort((left, right) => right.version - left.version)
        : [];
      const sequenceIds = new Set(sequenceVersions.map((sequence) => sequence.id));
      const enrollments = snapshot.enrollments
        .filter((enrollment) => enrollment.campaignId === campaign.id)
        .sort((left, right) =>
          right.enteredSequenceAt.localeCompare(left.enteredSequenceAt),
        );
      const replies = snapshot.replies
        .filter((reply) => reply.campaignId === campaign.id)
        .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
      const appointments = snapshot.appointments
        .filter((appointment) => appointment.campaignId === campaign.id)
        .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));

      return {
        campaign,
        offer: offerById.get(campaign.offerId),
        icpProfile: icpById.get(campaign.primaryIcpProfileId),
        currentSequence,
        sequenceVersions,
        enrollments,
        replies,
        appointments,
        experiments: snapshot.experiments.filter(
          (experiment) =>
            (experiment.targetEntityType === "campaign" &&
              experiment.targetEntityId === campaign.id) ||
            (experiment.targetEntityType === "sequence" &&
              Boolean(experiment.targetEntityId) &&
              sequenceIds.has(experiment.targetEntityId as SequenceId)),
        ),
        insights: snapshot.insights.filter(
          (insight) =>
            (insight.sourceEntityType === "campaign" &&
              insight.sourceEntityId === campaign.id) ||
            (insight.sourceEntityType === "sequence" &&
              Boolean(insight.sourceEntityId) &&
              sequenceIds.has(insight.sourceEntityId as SequenceId)),
        ),
        memoryEntries: snapshot.memoryEntries.filter(
          (entry) =>
            (entry.relatedEntityType === "campaign" &&
              entry.relatedEntityId === campaign.id) ||
            (entry.relatedEntityType === "sequence" &&
              Boolean(entry.relatedEntityId) &&
              sequenceIds.has(entry.relatedEntityId as SequenceId)),
        ),
      };
    })
    .sort((left, right) => {
      return (
        campaignStatusOrder[left.campaign.status] -
          campaignStatusOrder[right.campaign.status] ||
        right.campaign.updatedAt.localeCompare(left.campaign.updatedAt) ||
        left.campaign.name.localeCompare(right.campaign.name)
      );
    });

  return {
    records,
    offerById,
    companyById,
    contactById,
    sequenceById,
    sequences: snapshot.sequences,
  };
}

function getNextActionAt(record: CampaignRecord) {
  const nextDates = [
    ...record.enrollments
      .map((enrollment) => enrollment.nextActionAt)
      .filter((value): value is string => Boolean(value)),
    ...record.appointments
      .map((appointment) => appointment.scheduledFor)
      .filter((value): value is string => Boolean(value)),
  ].sort((left, right) => left.localeCompare(right));

  return nextDates[0];
}

function buildCampaignMetrics(
  record: CampaignRecord,
): CampaignHealthStatusMetricsView {
  const active = record.enrollments.filter(
    (enrollment) => enrollment.state === "active",
  ).length;
  const waiting = record.enrollments.filter(
    (enrollment) => enrollment.state === "waiting",
  ).length;
  const replied = record.enrollments.filter(
    (enrollment) => enrollment.state === "replied",
  ).length;
  const booked = record.enrollments.filter(
    (enrollment) => enrollment.state === "booked",
  ).length;
  const paused = record.enrollments.filter(
    (enrollment) => enrollment.state === "paused",
  ).length;
  const completed = record.enrollments.filter(
    (enrollment) => enrollment.state === "completed",
  ).length;
  const failed = record.enrollments.filter(
    (enrollment) => enrollment.state === "failed",
  ).length;
  const repliesReceived = record.replies.length;
  const positiveReplies = record.replies.filter(
    (reply) => reply.classification === "positive",
  ).length;
  const reviewRequired = record.replies.filter(
    (reply) => reply.requiresHumanReview,
  ).length;
  const bookedAppointments = record.appointments.length;
  const totalEnrolled = record.enrollments.length;
  const nextActionAt = getNextActionAt(record);

  const baseMetrics = {
    totalEnrolled,
    active,
    waiting,
    replied,
    booked,
    paused,
    completed,
    failed,
    blockedOrNeedsReview: failed + reviewRequired,
    repliesReceived,
    positiveReplies,
    reviewRequired,
    bookedAppointments,
    replyRateLabel: formatPercent(repliesReceived, totalEnrolled),
    bookedRateLabel: formatPercent(bookedAppointments, totalEnrolled),
  };

  let nextAction = "Review campaign health and keep the current sequence on track.";

  if (record.campaign.status === "draft") {
    nextAction = `Finish ${record.currentSequence ? `v${record.currentSequence.version}` : "the draft"} QA and choose the first seed cohort.`;
  } else if (reviewRequired > 0) {
    nextAction = `Review ${reviewRequired} ${pluralize("reply", reviewRequired)} and decide the manual follow-up.`;
  } else if (failed > 0) {
    nextAction = `Replace ${failed} blocked ${pluralize("contact", failed)} before re-enrollment.`;
  } else if (waiting > 0) {
    nextAction = `Prep the next touch for ${waiting} waiting ${pluralize("enrollment", waiting)}.`;
  } else if (active > 0) {
    nextAction = `Monitor ${active} live ${pluralize("enrollment", active)} and watch reply quality.`;
  } else if (bookedAppointments > 0) {
    nextAction = `Protect ${bookedAppointments} booked ${pluralize("appointment", bookedAppointments)} and capture outcome notes.`;
  } else if (paused > 0) {
    nextAction = `Decide whether to reopen ${paused} paused ${pluralize("enrollment", paused)}.`;
  } else if (record.campaign.status === "active" && totalEnrolled === 0) {
    nextAction = "Seed the first ready contacts into this campaign.";
  } else if (completed > 0) {
    nextAction = "Review exhaustion data before refreshing the segment.";
  }

  return {
    campaignId: record.campaign.id,
    statusBadge: getCampaignStatusBadge(record.campaign.status),
    healthBadge: getHealthBadge(record.campaign, baseMetrics),
    ...baseMetrics,
    nextAction,
    nextActionAtLabel: nextActionAt ? formatDateTime(nextActionAt) : undefined,
  };
}

function buildSequenceSummary(
  sequence: Sequence,
  sequences: Sequence[],
  offerById: Map<string, Offer>,
): CampaignSequenceSummaryView {
  const versions = sequences
    .filter((candidate) => candidate.lineageKey === sequence.lineageKey)
    .sort((left, right) => {
      return (
        right.version - left.version ||
        sequenceStatusOrder[left.status] - sequenceStatusOrder[right.status]
      );
    });

  return {
    sequenceId: sequence.id,
    name: sequence.name,
    versionLabel: `v${sequence.version}`,
    stepCountLabel: `${sequence.steps.length} steps`,
    audienceSummary: sequence.audienceSummary,
    goal: sequence.goal,
    offerName: offerById.get(sequence.offerId)?.name ?? "Offer pending",
    targetTierLabel: formatPriorityLabel(sequence.targetTier),
    statusBadge: getSequenceStatusBadge(sequence.status),
    steps: sequence.steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((step) => ({
        id: step.id,
        stepNumber: step.order,
        stepType: formatLabel(step.type),
        subject: step.subject,
        bodyPreview: step.bodyPreview,
        delayLabel:
          step.order === 1 ? "Immediate send" : `${step.delayDays} days after prior step`,
        goal: step.goal,
        cta: step.cta,
      })),
    versions: versions.map((candidate) => ({
      sequenceId: candidate.id,
      versionLabel: `v${candidate.version}`,
      statusBadge: getSequenceStatusBadge(candidate.status),
      description: `${candidate.steps.length} steps • ${candidate.audienceSummary}`,
      goal: candidate.goal,
      isCurrent: candidate.id === sequence.id,
    })),
  };
}

function buildCampaignDetailView(
  record: CampaignRecord,
  context: CampaignSelectorContext,
): CampaignDetailView {
  const metrics = buildCampaignMetrics(record);
  const linkedSequence = record.currentSequence
    ? buildSequenceSummary(
        record.currentSequence,
        context.sequences,
        context.offerById,
      )
    : undefined;
  const latestReply = record.replies[0];
  const latestAppointment = [...record.appointments].sort((left, right) =>
    right.bookedAt.localeCompare(left.bookedAt),
  )[0];
  const upcomingAppointment = record.appointments.find(
    (appointment) => appointment.status === "scheduled" || appointment.status === "proposed",
  );
  const readinessNotes = [
    metrics.failed > 0
      ? `${metrics.failed} ${pluralize("enrollment", metrics.failed)} is blocked by a bounced or invalid contact path.`
      : null,
    metrics.waiting > 0 && metrics.nextActionAtLabel
      ? `${metrics.waiting} ${pluralize("enrollment", metrics.waiting)} is waiting for the next step on ${metrics.nextActionAtLabel}.`
      : null,
    metrics.reviewRequired > 0
      ? `${metrics.reviewRequired} ${pluralize("reply", metrics.reviewRequired)} needs operator review before the next touch.`
      : null,
    metrics.totalEnrolled === 0 && record.campaign.status === "draft"
      ? "No contacts are enrolled yet, so launch readiness depends on list QA and sequence review."
      : null,
    ...record.memoryEntries.map((entry) => entry.summary),
  ].filter((value): value is string => Boolean(value));
  const experimentNotes = [
    ...record.experiments.map(
      (experiment) => `${formatLabel(experiment.status)} experiment: ${experiment.hypothesis}`,
    ),
    ...record.insights.map(
      (insight) =>
        `${Math.round(insight.confidence * 100)}% confidence: ${insight.summary}`,
    ),
  ];

  return {
    campaignId: record.campaign.id,
    campaignName: record.campaign.name,
    description: record.campaign.description,
    objective: record.campaign.objective,
    statusBadges: [
      metrics.statusBadge,
      metrics.healthBadge,
      linkedSequence?.statusBadge ?? { label: "No sequence", tone: "muted" },
    ],
    basics: [
      { label: "Offer", value: record.offer?.name ?? "Offer pending" },
      { label: "Channel", value: formatChannelLabel(record.campaign.channel) },
      { label: "Goal metric", value: "Appointments booked" },
      {
        label: "Sequence",
        value: linkedSequence
          ? `${linkedSequence.name} ${linkedSequence.versionLabel}`
          : "Sequence pending",
      },
      {
        label: "Sequence health",
        value: linkedSequence
          ? `${linkedSequence.stepCountLabel} • ${linkedSequence.statusBadge.label}`
          : "No linked sequence",
      },
      { label: "Last updated", value: formatDateTime(record.campaign.updatedAt) },
    ],
    targeting: [
      { label: "ICP", value: record.icpProfile?.name ?? "Unassigned ICP" },
      { label: "Priority tier", value: formatPriorityLabel(record.campaign.targetTier) },
      {
        label: "Audience summary",
        value:
          linkedSequence?.audienceSummary ??
          record.icpProfile?.summary ??
          "Audience summary pending",
      },
      {
        label: "Offer angle",
        value: record.offer?.firstOutreachAngle ?? "Offer angle pending",
      },
    ],
    enrollmentSummary: [
      { label: "Total enrolled", value: String(metrics.totalEnrolled) },
      { label: "Active", value: String(metrics.active) },
      { label: "Waiting", value: String(metrics.waiting) },
      { label: "Replied", value: String(metrics.replied) },
      { label: "Booked", value: String(metrics.booked) },
      { label: "Paused", value: String(metrics.paused) },
      { label: "Completed / exhausted", value: String(metrics.completed) },
      {
        label: "Blocked / review",
        value: `${metrics.failed} blocked • ${metrics.reviewRequired} review`,
      },
    ],
    replySummary: [
      {
        label: "Replies received",
        value: `${metrics.repliesReceived} • ${metrics.replyRateLabel}`,
      },
      { label: "Positive replies", value: String(metrics.positiveReplies) },
      { label: "Needs review", value: String(metrics.reviewRequired) },
      {
        label: "Latest reply",
        value: latestReply
          ? `${formatLabel(latestReply.classification)} • ${formatDateTime(latestReply.receivedAt)}`
          : "No replies yet",
      },
    ],
    appointmentSummary: [
      {
        label: "Attributed appointments",
        value: `${metrics.bookedAppointments} • ${metrics.bookedRateLabel}`,
      },
      {
        label: "Upcoming meeting",
        value: upcomingAppointment
          ? `${formatDateTime(upcomingAppointment.scheduledFor)} • ${upcomingAppointment.timezone}`
          : "No meeting booked",
      },
      {
        label: "Latest booked",
        value: latestAppointment
          ? formatDateTime(latestAppointment.bookedAt)
          : "No appointments attributed yet",
      },
      {
        label: "Booking note",
        value:
          metrics.bookedAppointments > 0
            ? "Capture meeting outcomes so future variants learn from booked conversations."
            : "No appointment attribution yet.",
      },
    ],
    linkedSequence,
    suggestedNextAction: metrics.nextAction,
    readinessNotes,
    experimentNotes,
    recentReplies: record.replies.slice(0, 3).map((reply) => ({
      id: reply.id,
      companyName: context.companyById.get(reply.companyId)?.name ?? "Unknown company",
      contactName:
        context.contactById.get(reply.contactId)?.fullName ??
        context.contactById.get(reply.contactId)?.title ??
        "Unknown contact",
      classificationLabel: formatLabel(reply.classification),
      classificationBadge: getReplyClassificationBadge(reply.classification),
      receivedAtLabel: formatDateTime(reply.receivedAt),
      snippet: reply.snippet,
    })),
  };
}

function getStatusOptions(records: CampaignRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "paused", label: "Paused" },
      { value: "completed", label: "Completed" },
      { value: "archived", label: "Archived" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.campaign.status === value).length,
  );
}

function getOfferOptions(records: CampaignRecord[]) {
  const seenOffers = new Map<string, string>();

  for (const record of records) {
    if (record.offer) {
      seenOffers.set(record.offer.id, record.offer.name);
    }
  }

  return makeCountedOptions(
    [
      { value: "all", label: "All offers" },
      ...[...seenOffers.entries()].map(([value, label]) => ({ value, label })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.campaign.offerId === value).length,
  );
}

function getIcpOptions(records: CampaignRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All ICPs" },
      ...initialIcpProfiles.map((profile) => ({
        value: profile.id,
        label: profile.name,
      })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.campaign.primaryIcpProfileId === value).length,
  );
}

function getChannelOptions(records: CampaignRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All channels" },
      { value: "email", label: "Email" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.campaign.channel === value).length,
  );
}

function buildRows(records: CampaignRecord[]): CampaignListRowView[] {
  return records.map((record) => {
    const metrics = buildCampaignMetrics(record);
    const currentSequence = record.currentSequence;

    return {
      campaignId: record.campaign.id,
      campaignName: record.campaign.name,
      description: record.campaign.description,
      icpLabel: record.icpProfile?.name ?? "Unassigned ICP",
      offerName: record.offer?.name ?? "Offer pending",
      channelLabel: formatChannelLabel(record.campaign.channel),
      statusBadge: metrics.statusBadge,
      healthBadge: metrics.healthBadge,
      sequenceVersionLabel: currentSequence
        ? `v${currentSequence.version} • ${currentSequence.steps.length} steps`
        : "Sequence pending",
      enrollmentsLabel: `${metrics.totalEnrolled} total • ${metrics.active + metrics.waiting} in flight`,
      repliesLabel: `${metrics.repliesReceived} total • ${metrics.replyRateLabel}`,
      bookedAppointmentsLabel: `${metrics.bookedAppointments} total • ${metrics.bookedRateLabel}`,
      nextAction: metrics.nextAction,
      nextActionAtLabel: metrics.nextActionAtLabel,
    };
  });
}

function buildStats(records: CampaignRecord[]): WorkspaceStat[] {
  const metrics = records.map(buildCampaignMetrics);
  const totalCampaigns = records.length;
  const activeCampaigns = records.filter(
    (record) => record.campaign.status === "active",
  ).length;
  const draftCampaigns = records.filter(
    (record) => record.campaign.status === "draft",
  ).length;
  const totalEnrolled = metrics.reduce(
    (sum, metric) => sum + metric.totalEnrolled,
    0,
  );
  const totalReplies = metrics.reduce(
    (sum, metric) => sum + metric.repliesReceived,
    0,
  );
  const totalAppointments = metrics.reduce(
    (sum, metric) => sum + metric.bookedAppointments,
    0,
  );
  const inFlight = metrics.reduce(
    (sum, metric) => sum + metric.active + metric.waiting,
    0,
  );

  return [
    {
      label: "Total campaigns",
      value: String(totalCampaigns),
      detail: "Campaigns currently visible in the operational workspace.",
      change: `${records.length} in view`,
      tone: "neutral",
    },
    {
      label: "Active campaigns",
      value: String(activeCampaigns),
      detail: "Campaigns currently running against typed enrollments and replies.",
      change: `${formatPercent(activeCampaigns, totalCampaigns)} live`,
      tone: "positive",
    },
    {
      label: "Draft campaigns",
      value: String(draftCampaigns),
      detail: "Campaigns still in QA before operators move a real cohort into the sequence.",
      change: draftCampaigns > 0 ? "Needs review" : "No drafts",
      tone: draftCampaigns > 0 ? "warning" : "neutral",
    },
    {
      label: "Contacts enrolled",
      value: String(totalEnrolled),
      detail: "Sequence enrollments tied to campaigns, offers, and contacts in the typed mock store.",
      change: `${inFlight} in flight`,
      tone: "neutral",
    },
    {
      label: "Replies received",
      value: String(totalReplies),
      detail: "Reply records classified through the typed outbound lifecycle.",
      change: formatPercent(totalReplies, totalEnrolled),
      tone: "positive",
    },
    {
      label: "Appointments attributed",
      value: String(totalAppointments),
      detail: "Meetings attributed back to campaign and enrollment records.",
      change: formatPercent(totalAppointments, totalEnrolled),
      tone: totalAppointments > 0 ? "positive" : "neutral",
    },
  ];
}

export async function getCampaignHealthStatusMetrics(
  campaignId: CampaignId,
): Promise<CampaignHealthStatusMetricsView | undefined> {
  const context = buildCampaignSelectorContext(await getSelectorDataSnapshot());
  const record = context.records.find((candidate) => candidate.campaign.id === campaignId);

  return record ? buildCampaignMetrics(record) : undefined;
}

export async function getCampaignSequenceSummary(
  sequenceId: SequenceId,
): Promise<CampaignSequenceSummaryView | undefined> {
  const context = buildCampaignSelectorContext(await getSelectorDataSnapshot());
  const sequence = context.sequenceById.get(sequenceId);

  return sequence
    ? buildSequenceSummary(sequence, context.sequences, context.offerById)
    : undefined;
}

export async function getCampaignDetailView(
  campaignId: CampaignId,
): Promise<CampaignDetailView | undefined> {
  const context = buildCampaignSelectorContext(await getSelectorDataSnapshot());
  const record = context.records.find((candidate) => candidate.campaign.id === campaignId);

  return record ? buildCampaignDetailView(record, context) : undefined;
}

export async function getCampaignsWorkspaceView(
  searchParams: SearchParamsInput,
): Promise<CampaignsWorkspaceView> {
  const filters: CampaignsWorkspaceFilters = {
    q: readSearchParam(searchParams.q).trim(),
    status: readSearchParam(searchParams.status) || "all",
    offer: readSearchParam(searchParams.offer) || "all",
    icp: readSearchParam(searchParams.icp) || "all",
    channel: readSearchParam(searchParams.channel) || "all",
    campaignId: readSearchParam(searchParams.campaignId),
  };

  const context = buildCampaignSelectorContext(await getSelectorDataSnapshot());
  const records = context.records;
  const filteredRecords = records.filter((record) => {
    return (
      matchesSearch(record, filters.q) &&
      (filters.status === "all" || record.campaign.status === filters.status) &&
      (filters.offer === "all" || record.campaign.offerId === filters.offer) &&
      (filters.icp === "all" ||
        record.campaign.primaryIcpProfileId === filters.icp) &&
      (filters.channel === "all" || record.campaign.channel === filters.channel)
    );
  });

  const selectedRecord =
    filteredRecords.find((record) => record.campaign.id === filters.campaignId) ??
    filteredRecords[0];

  const query = cleanQuery({
    q: filters.q,
    status: filters.status !== "all" ? filters.status : "",
    offer: filters.offer !== "all" ? filters.offer : "",
    icp: filters.icp !== "all" ? filters.icp : "",
    channel: filters.channel !== "all" ? filters.channel : "",
  });

  return {
    stats: buildStats(filteredRecords),
    filters: {
      values: filters,
      statusOptions: getStatusOptions(records),
      offerOptions: getOfferOptions(records),
      icpOptions: getIcpOptions(records),
      channelOptions: getChannelOptions(records),
    },
    rows: buildRows(filteredRecords),
    selectedCampaign: selectedRecord
      ? buildCampaignDetailView(selectedRecord, context)
      : undefined,
    query,
    hasActiveFilters: Object.keys(query).length > 0,
    resultLabel:
      filteredRecords.length === 1
        ? "1 campaign in view"
        : `${filteredRecords.length} campaigns in view`,
    emptyState: {
      title: "No campaigns match the current workspace filters",
      description:
        "Adjust the campaign filters or clear them to reopen the modeled outbound workspace.",
    },
  };
}
