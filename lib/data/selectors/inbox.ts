import { initialIcpProfiles } from "@/lib/data/config/icp";
import {
  cleanQuery,
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
  Company,
  Contact,
  Enrollment,
  Insight,
  MemoryEntry,
  Offer,
  Reply,
  ReplyClassification,
  ReplySentiment,
  Sequence,
} from "@/lib/domain";

const operationsNow = new Date("2026-03-23T12:00:00.000Z");

const icpById = new Map(initialIcpProfiles.map((profile) => [profile.id, profile]));

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

type ReplyHandlingPath =
  | "booking"
  | "pause"
  | "nurture"
  | "disqualify"
  | "manual";

interface InboxReplyRecord {
  reply: Reply;
  enrollment?: Enrollment;
  company?: Company;
  contact?: Contact;
  campaign?: Campaign;
  offer?: Offer;
  sequence?: Sequence;
  appointment?: Appointment;
  primaryContact?: Contact;
  relatedInsights: Insight[];
  relatedNotes: MemoryEntry[];
}

export interface InboxSummaryMetricsView {
  totalReplies: number;
  needingReview: number;
  interested: number;
  objections: number;
  wrongPerson: number;
  unsubscribes: number;
  booked: number;
}

export interface InboxWorkspaceFilters {
  q: string;
  classification: string;
  campaign: string;
  offer: string;
  icp: string;
  review: string;
  status: string;
  date: string;
  replyId: string;
}

export interface InboxReplyRowView {
  replyId: string;
  companyName: string;
  contactName: string;
  campaignName: string;
  offerName: string;
  icpLabel: string;
  classificationBadge: SelectorBadge;
  sentimentBadge?: SelectorBadge;
  reviewBadge: SelectorBadge;
  nextAction: string;
  latestReplyPreview: string;
  receivedAtLabel: string;
  pipelineBadge: SelectorBadge;
  pipelineLabel: string;
}

export interface ReplyDetailView {
  replyId: string;
  companyName: string;
  market: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  campaignName: string;
  offerName: string;
  icpLabel: string;
  campaignObjective: string;
  sequenceContext: string;
  classificationBadge: SelectorBadge;
  sentimentBadge?: SelectorBadge;
  reviewBadge: SelectorBadge;
  handlingBadge: SelectorBadge;
  handlingSummary: string;
  receivedAtLabel: string;
  recommendedNextAction: string;
  enrollmentStateBadge: SelectorBadge;
  latestReplyPreview: string;
  latestReplyText: string;
  companyContext: Array<{ label: string; value: string }>;
  campaignContext: Array<{ label: string; value: string }>;
  enrollmentContext: Array<{ label: string; value: string }>;
  notes: string[];
  insights: string[];
  relatedAppointment?: {
    appointmentId: string;
    statusBadge: SelectorBadge;
    scheduledForLabel: string;
    timezone: string;
    notes: string;
  };
}

export interface InboxWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: InboxWorkspaceFilters;
    classificationOptions: FilterOption[];
    campaignOptions: FilterOption[];
    offerOptions: FilterOption[];
    icpOptions: FilterOption[];
    reviewOptions: FilterOption[];
    statusOptions: FilterOption[];
    dateOptions: FilterOption[];
  };
  rows: InboxReplyRowView[];
  selectedReply?: ReplyDetailView;
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

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function getReplyClassificationBadge(
  classification: ReplyClassification,
): SelectorBadge {
  switch (classification) {
    case "positive":
      return { label: "Interested", tone: "success" };
    case "objection":
      return { label: "Objection", tone: "warning" };
    case "not_now":
      return { label: "Not now", tone: "accent" };
    case "not_interested":
      return { label: "Not interested", tone: "danger" };
    case "wrong_person":
      return { label: "Wrong person", tone: "accent" };
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

function getReplySentimentBadge(sentiment?: ReplySentiment): SelectorBadge | undefined {
  if (!sentiment) {
    return undefined;
  }

  switch (sentiment) {
    case "positive":
      return { label: "Positive", tone: "success" };
    case "neutral":
      return { label: "Neutral", tone: "muted" };
    case "mixed":
      return { label: "Mixed", tone: "accent" };
    case "negative":
      return { label: "Negative", tone: "danger" };
  }
}

function getReviewBadge(requiresHumanReview: boolean): SelectorBadge {
  return requiresHumanReview
    ? { label: "Human review", tone: "warning" }
    : { label: "Clear", tone: "success" };
}

function getEnrollmentStateBadge(state?: Enrollment["state"]): SelectorBadge {
  switch (state) {
    case "booked":
      return { label: "Booked", tone: "success" };
    case "replied":
      return { label: "Replied", tone: "accent" };
    case "paused":
      return { label: "Paused", tone: "warning" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "waiting":
      return { label: "Waiting", tone: "muted" };
    case "active":
      return { label: "Active", tone: "accent" };
    case "pending":
      return { label: "Pending", tone: "muted" };
    case "completed":
      return { label: "Completed", tone: "success" };
    default:
      return { label: "No enrollment", tone: "muted" };
  }
}

function getAppointmentStatusBadge(status?: Appointment["status"]): SelectorBadge {
  switch (status) {
    case "scheduled":
      return { label: "Scheduled", tone: "success" };
    case "proposed":
      return { label: "Proposed", tone: "accent" };
    case "completed":
      return { label: "Completed", tone: "success" };
    case "canceled":
      return { label: "Canceled", tone: "danger" };
    case "no_show":
      return { label: "No-show", tone: "danger" };
    default:
      return { label: "No meeting", tone: "muted" };
  }
}

function getHandlingBadge(path: ReplyHandlingPath): SelectorBadge {
  switch (path) {
    case "booking":
      return { label: "Move to booking", tone: "success" };
    case "pause":
      return { label: "Pause", tone: "warning" };
    case "nurture":
      return { label: "Nurture", tone: "accent" };
    case "disqualify":
      return { label: "Disqualify", tone: "danger" };
    case "manual":
      return { label: "Manual handling", tone: "warning" };
  }
}

function listInboxReplyRecords(snapshot: SelectorDataSnapshot): InboxReplyRecord[] {
  const companyById = buildIdMap(snapshot.companies);
  const contactById = buildIdMap(snapshot.contacts);
  const campaignById = buildIdMap(snapshot.campaigns);
  const offerById = buildIdMap(snapshot.offers);
  const sequenceById = buildIdMap(snapshot.sequences);
  const enrollmentById = buildIdMap(snapshot.enrollments);
  const appointmentByReplyId = new Map(
    snapshot.appointments.map((appointment) => [appointment.replyId, appointment] as const),
  );

  return snapshot.replies
    .map((reply) => {
      const enrollment = enrollmentById.get(reply.enrollmentId);
      const company = companyById.get(reply.companyId);
      const contact = contactById.get(reply.contactId);
      const campaign = campaignById.get(reply.campaignId);
      const offer = offerById.get(reply.offerId);
      const sequence = enrollment ? sequenceById.get(enrollment.sequenceId) : undefined;
      const appointment =
        appointmentByReplyId.get(reply.id) ??
        (enrollment?.appointmentId
          ? snapshot.appointments.find(
              (candidate) => candidate.id === enrollment.appointmentId,
            )
          : undefined);
      const primaryContact = company?.primaryContactId
        ? contactById.get(company.primaryContactId)
        : undefined;
      const relatedEntityIds = new Set<string | undefined>([
        reply.id,
        reply.companyId,
        reply.contactId,
        reply.campaignId,
        reply.offerId,
        reply.enrollmentId,
        appointment?.id,
      ]);

      return {
        reply,
        enrollment,
        company,
        contact,
        campaign,
        offer,
        sequence,
        appointment,
        primaryContact,
        relatedInsights: snapshot.insights.filter((insight) =>
          relatedEntityIds.has(insight.sourceEntityId),
        ),
        relatedNotes: snapshot.memoryEntries.filter((entry) =>
          relatedEntityIds.has(entry.relatedEntityId),
        ),
      };
    })
    .sort((left, right) => right.reply.receivedAt.localeCompare(left.reply.receivedAt));
}

function deriveReplyHandling(record: InboxReplyRecord): ReplyHandlingPath {
  if (record.appointment || record.reply.indicatesBookingIntent) {
    return "booking";
  }

  switch (record.reply.classification) {
    case "not_now":
      return "nurture";
    case "out_of_office":
      return "pause";
    case "unsubscribe":
    case "not_interested":
      return "disqualify";
    case "wrong_person":
    case "objection":
    case "bounced":
    case "unknown":
      return "manual";
    case "positive":
      return "booking";
  }
}

function getReplyRecommendedNextAction(record: InboxReplyRecord) {
  if (record.appointment) {
    return `Prepare ${record.contact?.fullName ?? "the contact"} for the booked meeting and keep the agenda tied to ${record.offer?.name ?? "the offer"}.`;
  }

  switch (record.reply.classification) {
    case "positive":
      return `Move this thread into booking handoff and offer times for ${formatDate(operationsNow.toISOString())} through ${formatDate(
        new Date(operationsNow.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      )}.`;
    case "objection":
      return "Review the objection manually, respond with proof, and tighten the value narrative before sending the next step.";
    case "not_now":
      return "Pause the enrollment, note the timing constraint, and move the account into a later nurture follow-up.";
    case "not_interested":
      return "Suppress this contact for the current offer and capture the fit signal so future campaigns do not re-push the same angle.";
    case "wrong_person":
      return record.primaryContact
        ? `Pause the current thread and reroute the next touch to ${record.primaryContact.fullName ?? "the known owner"} with the same campaign context.`
        : "Pause the current thread and source the real decision-maker before resuming outreach.";
    case "out_of_office":
      return "Hold the sequence until the contact is back, then resume from the most recent relevant step.";
    case "bounced":
      return "Verify the email address or swap to a stronger contact before this enrollment re-enters any live sequence.";
    case "unsubscribe":
      return "Mark the contact as suppressed, stop future outreach, and keep the account out of live reply queues.";
    case "unknown":
      return "Route to manual triage so the reply can be classified before the enrollment moves again.";
  }
}

function getReplyPipelineView(record: InboxReplyRecord) {
  if (record.appointment) {
    return {
      badge: getAppointmentStatusBadge(record.appointment.status),
      label: `${record.appointment.status.replaceAll("_", " ")} • ${formatDateTime(
        record.appointment.scheduledFor,
      )}`,
    };
  }

  return {
    badge: getEnrollmentStateBadge(record.enrollment?.state),
    label: record.enrollment
      ? `${formatLabel(record.enrollment.state)} enrollment`
      : "No active enrollment",
  };
}

function getMarketLabel(company?: Company) {
  if (!company) {
    return "Market unavailable";
  }

  return `${company.location.city}, ${company.location.state}`;
}

function getContactLabel(contact?: Contact) {
  return contact?.fullName ?? "Unknown contact";
}

function getContactRoleLabel(contact?: Contact) {
  if (!contact) {
    return "Role unavailable";
  }

  return contact.title ?? formatLabel(contact.role);
}

function getIcpLabel(company?: Company) {
  return company ? icpById.get(company.icpProfileId)?.name ?? "Unassigned ICP" : "Unknown ICP";
}

function getSequenceContext(record: InboxReplyRecord) {
  if (!record.sequence || !record.enrollment) {
    return "Sequence context unavailable";
  }

  const stepCount = record.sequence.steps.length;
  const currentIndex = Math.min(record.enrollment.currentStepIndex, stepCount - 1);
  const step = record.sequence.steps[currentIndex];

  return step
    ? `${record.sequence.name} • Step ${step.order} of ${stepCount} • ${step.subject}`
    : `${record.sequence.name} • ${stepCount} steps`;
}

function getReplyNotes(record: InboxReplyRecord) {
  const items = [
    ...(record.contact?.notes ?? []),
    ...(record.primaryContact && record.primaryContact.id !== record.contact?.id
      ? record.primaryContact.notes
      : []),
    ...(record.company?.painSignals ?? []),
    ...record.relatedNotes.map((entry) => `${entry.title}: ${entry.summary}`),
  ];

  return Array.from(new Set(items)).slice(0, 6);
}

function getReplyInsights(record: InboxReplyRecord) {
  const items = record.relatedInsights.map(
    (insight) => `${insight.title}: ${insight.summary}`,
  );

  return Array.from(new Set(items)).slice(0, 4);
}

function matchesDateWindow(receivedAt: string, filter: string) {
  if (filter === "all") {
    return true;
  }

  const replyDate = new Date(receivedAt);
  const hoursDiff = (operationsNow.getTime() - replyDate.getTime()) / (60 * 60 * 1000);

  switch (filter) {
    case "last_24h":
      return hoursDiff <= 24;
    case "last_7d":
      return hoursDiff <= 24 * 7;
    case "older":
      return hoursDiff > 24 * 7;
    default:
      return true;
  }
}

function matchesSearch(record: InboxReplyRecord, search: string) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  const haystack = [
    record.company?.name ?? "",
    getMarketLabel(record.company),
    getContactLabel(record.contact),
    getContactRoleLabel(record.contact),
    record.contact?.email ?? "",
    record.campaign?.name ?? "",
    record.offer?.name ?? "",
    record.reply.classification,
    record.reply.snippet,
    record.reply.bodyText,
    getIcpLabel(record.company),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function getClassificationOptions(records: InboxReplyRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All classifications" },
      { value: "positive", label: "Interested" },
      { value: "objection", label: "Objection" },
      { value: "wrong_person", label: "Wrong person" },
      { value: "not_now", label: "Not now" },
      { value: "bounced", label: "Bounced" },
      { value: "unsubscribe", label: "Unsubscribes" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.reply.classification === value).length,
  );
}

function getCampaignOptions(
  records: InboxReplyRecord[],
  campaigns: readonly Campaign[],
) {
  return makeCountedOptions(
    [
      { value: "all", label: "All campaigns" },
      ...campaigns.map((campaign) => ({
        value: campaign.id,
        label: campaign.name,
      })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.reply.campaignId === value).length,
  );
}

function getOfferOptions(
  records: InboxReplyRecord[],
  offers: readonly Offer[],
) {
  return makeCountedOptions(
    [
      { value: "all", label: "All offers" },
      ...offers.map((offer) => ({
        value: offer.id,
        label: offer.name,
      })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.reply.offerId === value).length,
  );
}

function getIcpOptions(records: InboxReplyRecord[]) {
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
        : records.filter((record) => record.company?.icpProfileId === value).length,
  );
}

function getReviewOptions(records: InboxReplyRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All replies" },
      { value: "requires_review", label: "Needs review" },
      { value: "clear", label: "Clear" },
    ],
    (value) => {
      if (value === "all") {
        return records.length;
      }

      return records.filter((record) =>
        value === "requires_review"
          ? record.reply.requiresHumanReview
          : !record.reply.requiresHumanReview,
      ).length;
    },
  );
}

function getStatusOptions(records: InboxReplyRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All states" },
      { value: "booked", label: "Booked" },
      { value: "replied", label: "Replied" },
      { value: "paused", label: "Paused" },
      { value: "failed", label: "Failed" },
      { value: "waiting", label: "Waiting" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.enrollment?.state === value).length,
  );
}

function getDateOptions(records: InboxReplyRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All dates" },
      { value: "last_24h", label: "Last 24 hours" },
      { value: "last_7d", label: "Last 7 days" },
      { value: "older", label: "Older" },
    ],
    (value) => records.filter((record) => matchesDateWindow(record.reply.receivedAt, value)).length,
  );
}

export function getInboxSummaryMetrics(
  replies: readonly Reply[],
  appointments: readonly Appointment[],
) {
  const appointmentByReplyId = new Map(
    appointments.map((appointment) => [appointment.replyId, appointment] as const),
  );

  return {
    totalReplies: replies.length,
    needingReview: replies.filter((reply) => reply.requiresHumanReview).length,
    interested: replies.filter((reply) => reply.classification === "positive").length,
    objections: replies.filter((reply) => reply.classification === "objection").length,
    wrongPerson: replies.filter((reply) => reply.classification === "wrong_person").length,
    unsubscribes: replies.filter((reply) => reply.classification === "unsubscribe").length,
    booked: replies.filter(
      (reply) => reply.indicatesBookingIntent || appointmentByReplyId.has(reply.id),
    ).length,
  } satisfies InboxSummaryMetricsView;
}

function buildInboxStats(
  records: InboxReplyRecord[],
  totalReplies: number,
  appointments: Appointment[],
): WorkspaceStat[] {
  const metrics = getInboxSummaryMetrics(
    records.map((record) => record.reply),
    appointments,
  );

  return [
    {
      label: "Total replies",
      value: String(metrics.totalReplies),
      detail: "All reply records currently visible in the operational inbox.",
      change: `${totalReplies} tracked`,
      tone: "neutral",
    },
    {
      label: "Needs review",
      value: String(metrics.needingReview),
      detail: "Threads that still need operator judgment before the workflow moves forward.",
      tone: "warning",
    },
    {
      label: "Interested",
      value: String(metrics.interested),
      detail: "Replies showing clear interest or booking momentum.",
      tone: "positive",
    },
    {
      label: "Objections",
      value: String(metrics.objections),
      detail: "Accounts pushing back that should shape reply handling and proof points.",
      tone: "warning",
    },
    {
      label: "Wrong person",
      value: String(metrics.wrongPerson),
      detail: "Threads that should reroute to the real decision-maker instead of forcing the sequence forward.",
      tone: "neutral",
    },
    {
      label: "Unsubscribes",
      value: String(metrics.unsubscribes),
      detail: "Contacts that should stay suppressed from future outbound.",
      tone: "warning",
    },
    {
      label: "Booked",
      value: String(metrics.booked),
      detail: "Replies that already translated into meeting intent or an attached appointment.",
      tone: "positive",
    },
  ];
}

function buildReplyDetailView(record: InboxReplyRecord): ReplyDetailView {
  const handlingPath = deriveReplyHandling(record);

  return {
    replyId: record.reply.id,
    companyName: record.company?.name ?? "Unknown company",
    market: getMarketLabel(record.company),
    contactName: getContactLabel(record.contact),
    contactRole: getContactRoleLabel(record.contact),
    contactEmail: record.contact?.email ?? "Email unavailable",
    campaignName: record.campaign?.name ?? "Campaign unavailable",
    offerName: record.offer?.name ?? "Offer unavailable",
    icpLabel: getIcpLabel(record.company),
    campaignObjective:
      record.campaign?.objective ?? "Campaign objective is not available yet.",
    sequenceContext: getSequenceContext(record),
    classificationBadge: getReplyClassificationBadge(record.reply.classification),
    sentimentBadge: getReplySentimentBadge(record.reply.sentiment),
    reviewBadge: getReviewBadge(record.reply.requiresHumanReview),
    handlingBadge: getHandlingBadge(handlingPath),
    handlingSummary: formatLabel(handlingPath),
    receivedAtLabel: formatDateTime(record.reply.receivedAt),
    recommendedNextAction: getReplyRecommendedNextAction(record),
    enrollmentStateBadge: getEnrollmentStateBadge(record.enrollment?.state),
    latestReplyPreview: record.reply.snippet,
    latestReplyText: record.reply.bodyText,
    companyContext: [
      {
        label: "Company",
        value: record.company?.name ?? "Unknown company",
      },
      {
        label: "Market",
        value: getMarketLabel(record.company),
      },
      {
        label: "ICP",
        value: getIcpLabel(record.company),
      },
      {
        label: "Review profile",
        value: record.company?.presence.googleRating
          ? `${record.company.presence.googleRating.toFixed(1)} stars • ${record.company.presence.reviewCount ?? 0} reviews`
          : "Review profile unavailable",
      },
    ],
    campaignContext: [
      {
        label: "Campaign",
        value: record.campaign?.name ?? "Campaign unavailable",
      },
      {
        label: "Offer",
        value: record.offer?.name ?? "Offer unavailable",
      },
      {
        label: "Objective",
        value: record.campaign?.objective ?? "Objective unavailable",
      },
      {
        label: "Sequence",
        value: getSequenceContext(record),
      },
    ],
    enrollmentContext: [
      {
        label: "Enrollment state",
        value: record.enrollment ? formatLabel(record.enrollment.state) : "No enrollment",
      },
      {
        label: "Entered sequence",
        value: record.enrollment
          ? formatDateTime(record.enrollment.enteredSequenceAt)
          : "Unknown",
      },
      {
        label: "Last contacted",
        value: record.enrollment?.lastContactedAt
          ? formatDateTime(record.enrollment.lastContactedAt)
          : "Unknown",
      },
      {
        label: "Next action due",
        value: record.enrollment?.nextActionAt
          ? formatDateTime(record.enrollment.nextActionAt)
          : "No scheduled action",
      },
    ],
    notes: getReplyNotes(record),
    insights: getReplyInsights(record),
    relatedAppointment: record.appointment
      ? {
          appointmentId: record.appointment.id,
          statusBadge: getAppointmentStatusBadge(record.appointment.status),
          scheduledForLabel: formatDateTime(record.appointment.scheduledFor),
          timezone: record.appointment.timezone,
          notes: record.appointment.notes ?? "No appointment notes yet.",
        }
      : undefined,
  };
}

export async function getReplyDetailView(replyId: Reply["id"]) {
  const snapshot = await getSelectorDataSnapshot();
  const record = listInboxReplyRecords(snapshot).find(
    (candidate) => candidate.reply.id === replyId,
  );

  return record ? buildReplyDetailView(record) : undefined;
}

export async function getInboxWorkspaceView(
  searchParams: SearchParamsInput,
): Promise<InboxWorkspaceView> {
  const filters: InboxWorkspaceFilters = {
    q: readSearchParam(searchParams.q).trim(),
    classification: readSearchParam(searchParams.classification) || "all",
    campaign: readSearchParam(searchParams.campaign) || "all",
    offer: readSearchParam(searchParams.offer) || "all",
    icp: readSearchParam(searchParams.icp) || "all",
    review: readSearchParam(searchParams.review) || "all",
    status: readSearchParam(searchParams.status) || "all",
    date: readSearchParam(searchParams.date) || "all",
    replyId: readSearchParam(searchParams.replyId),
  };

  const snapshot = await getSelectorDataSnapshot();
  const records = listInboxReplyRecords(snapshot);
  const filteredRecords = records.filter((record) => {
    return (
      matchesSearch(record, filters.q) &&
      (filters.classification === "all" ||
        record.reply.classification === filters.classification) &&
      (filters.campaign === "all" || record.reply.campaignId === filters.campaign) &&
      (filters.offer === "all" || record.reply.offerId === filters.offer) &&
      (filters.icp === "all" || record.company?.icpProfileId === filters.icp) &&
      (filters.review === "all" ||
        (filters.review === "requires_review"
          ? record.reply.requiresHumanReview
          : !record.reply.requiresHumanReview)) &&
      (filters.status === "all" || record.enrollment?.state === filters.status) &&
      matchesDateWindow(record.reply.receivedAt, filters.date)
    );
  });

  const selectedRecord =
    filteredRecords.find((record) => record.reply.id === filters.replyId) ??
    filteredRecords[0];

  const rows = filteredRecords.map((record) => {
    const pipelineView = getReplyPipelineView(record);

    return {
      replyId: record.reply.id,
      companyName: record.company?.name ?? "Unknown company",
      contactName: getContactLabel(record.contact),
      campaignName: record.campaign?.name ?? "Campaign unavailable",
      offerName: record.offer?.name ?? "Offer unavailable",
      icpLabel: getIcpLabel(record.company),
      classificationBadge: getReplyClassificationBadge(record.reply.classification),
      sentimentBadge: getReplySentimentBadge(record.reply.sentiment),
      reviewBadge: getReviewBadge(record.reply.requiresHumanReview),
      nextAction: getReplyRecommendedNextAction(record),
      latestReplyPreview: record.reply.snippet,
      receivedAtLabel: formatDateTime(record.reply.receivedAt),
      pipelineBadge: pipelineView.badge,
      pipelineLabel: pipelineView.label,
    };
  });

  const filterQuery = cleanQuery({
    q: filters.q,
    classification: filters.classification !== "all" ? filters.classification : "",
    campaign: filters.campaign !== "all" ? filters.campaign : "",
    offer: filters.offer !== "all" ? filters.offer : "",
    icp: filters.icp !== "all" ? filters.icp : "",
    review: filters.review !== "all" ? filters.review : "",
    status: filters.status !== "all" ? filters.status : "",
    date: filters.date !== "all" ? filters.date : "",
  });

  const query = cleanQuery({
    ...filterQuery,
    replyId: selectedRecord?.reply.id ?? "",
  });

  return {
    stats: buildInboxStats(filteredRecords, snapshot.replies.length, snapshot.appointments),
    filters: {
      values: filters,
      classificationOptions: getClassificationOptions(records),
      campaignOptions: getCampaignOptions(records, snapshot.campaigns),
      offerOptions: getOfferOptions(records, snapshot.offers),
      icpOptions: getIcpOptions(records),
      reviewOptions: getReviewOptions(records),
      statusOptions: getStatusOptions(records),
      dateOptions: getDateOptions(records),
    },
    rows,
    selectedReply: selectedRecord ? buildReplyDetailView(selectedRecord) : undefined,
    query,
    hasActiveFilters: Object.keys(filterQuery).length > 0,
    resultLabel:
      filteredRecords.length === 1
        ? "1 reply in view"
        : `${filteredRecords.length} replies in view`,
    emptyState: {
      title: "No replies match the current inbox filters",
      description:
        "Widen the classification, campaign, review, or date filters to bring more reply threads back into the queue.",
    },
  };
}
