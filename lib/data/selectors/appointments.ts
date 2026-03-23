import { initialIcpProfiles } from "@/lib/data/config/icp";
import { getDataAccess } from "@/lib/data/access";
import {
  cleanQuery,
  makeCountedOptions,
  readSearchParam,
  type FilterOption,
  type SearchParamsInput,
  type SelectorBadge,
  type WorkspaceStat,
} from "@/lib/data/selectors/shared";
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
  Sequence,
} from "@/lib/domain";

const dataAccess = getDataAccess();
const operationsNow = new Date("2026-03-23T12:00:00.000Z");

const icpById = new Map(initialIcpProfiles.map((profile) => [profile.id, profile]));
const companyById = new Map(
  dataAccess.companies.list().map((company) => [company.id, company]),
);
const contactById = new Map(
  dataAccess.contacts.list().map((contact) => [contact.id, contact]),
);
const campaignById = new Map(
  dataAccess.campaigns.list().map((campaign) => [campaign.id, campaign]),
);
const offerById = new Map(dataAccess.offers.list().map((offer) => [offer.id, offer]));
const enrollmentById = new Map(
  dataAccess.enrollments.list().map((enrollment) => [enrollment.id, enrollment]),
);
const replyById = new Map(dataAccess.replies.list().map((reply) => [reply.id, reply]));
const sequenceById = new Map(
  dataAccess.sequences.list().map((sequence) => [sequence.id, sequence]),
);

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

interface AppointmentRecord {
  appointment: Appointment;
  company?: Company;
  contact?: Contact;
  campaign?: Campaign;
  offer?: Offer;
  enrollment?: Enrollment;
  reply?: Reply;
  sequence?: Sequence;
  relatedInsights: Insight[];
  relatedNotes: MemoryEntry[];
}

export interface AppointmentsWorkspaceFilters {
  q: string;
  status: string;
  campaign: string;
  offer: string;
  confirmation: string;
  window: string;
  appointmentId: string;
}

export interface AppointmentRowView {
  appointmentId: string;
  companyName: string;
  contactName: string;
  market: string;
  scheduledForLabel: string;
  statusBadge: SelectorBadge;
  confirmationBadge: SelectorBadge;
  campaignName: string;
  offerName: string;
  nextAction: string;
}

export interface AppointmentDetailView {
  appointmentId: string;
  companyName: string;
  market: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  campaignName: string;
  offerName: string;
  icpLabel: string;
  sequenceContext: string;
  statusBadge: SelectorBadge;
  confirmationBadge: SelectorBadge;
  scheduledForLabel: string;
  bookedAtLabel: string;
  recommendedFollowUpStep: string;
  basics: Array<{ label: string; value: string }>;
  sourceContext: Array<{ label: string; value: string }>;
  notes: string[];
  insights: string[];
  sourceReply?: {
    classificationBadge: SelectorBadge;
    receivedAtLabel: string;
    preview: string;
    bodyText: string;
  };
}

export interface AppointmentsWorkspaceView {
  stats: WorkspaceStat[];
  filters: {
    values: AppointmentsWorkspaceFilters;
    statusOptions: FilterOption[];
    campaignOptions: FilterOption[];
    offerOptions: FilterOption[];
    confirmationOptions: FilterOption[];
    windowOptions: FilterOption[];
  };
  rows: AppointmentRowView[];
  selectedAppointment?: AppointmentDetailView;
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

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function getStatusBadge(status: Appointment["status"]): SelectorBadge {
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
  }
}

function getConfirmationBadge(
  confirmationStatus: Appointment["confirmationStatus"],
): SelectorBadge {
  switch (confirmationStatus) {
    case "confirmed":
      return { label: "Confirmed", tone: "success" };
    case "pending":
      return { label: "Pending confirm", tone: "warning" };
    case "risk_flagged":
      return { label: "No-show risk", tone: "danger" };
  }
}

function getReplyClassificationBadge(classification: Reply["classification"]): SelectorBadge {
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

function listAppointmentRecords(): AppointmentRecord[] {
  return dataAccess.appointments
    .list()
    .map((appointment) => {
      const company = companyById.get(appointment.companyId);
      const contact = contactById.get(appointment.contactId);
      const campaign = campaignById.get(appointment.campaignId);
      const enrollment = enrollmentById.get(appointment.enrollmentId);
      const offer = enrollment ? offerById.get(enrollment.offerId) : undefined;
      const reply = replyById.get(appointment.replyId);
      const sequence = enrollment ? sequenceById.get(enrollment.sequenceId) : undefined;
      const relatedEntityIds = new Set<string | undefined>([
        appointment.id,
        appointment.companyId,
        appointment.contactId,
        appointment.campaignId,
        appointment.enrollmentId,
        appointment.replyId,
        offer?.id,
      ]);

      return {
        appointment,
        company,
        contact,
        campaign,
        offer,
        enrollment,
        reply,
        sequence,
        relatedInsights: dataAccess.insights.list().filter((insight) =>
          relatedEntityIds.has(insight.sourceEntityId),
        ),
        relatedNotes: dataAccess.memoryEntries.list().filter((entry) =>
          relatedEntityIds.has(entry.relatedEntityId),
        ),
      };
    })
    .sort((left, right) =>
      left.appointment.scheduledFor.localeCompare(right.appointment.scheduledFor),
    );
}

function getMarketLabel(company?: Company) {
  if (!company) {
    return "Market unavailable";
  }

  return `${company.location.city}, ${company.location.state}`;
}

function getContactName(contact?: Contact) {
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

function getSequenceContext(record: AppointmentRecord) {
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

function deriveAppointmentNextAction(record: AppointmentRecord) {
  switch (record.appointment.status) {
    case "proposed":
      return "Lock the meeting time, confirm the invite, and push the thread into a scheduled state.";
    case "scheduled":
      switch (record.appointment.confirmationStatus) {
        case "confirmed":
          return "Prep the call with company pain points, campaign proof, and a tight agenda.";
        case "pending":
          return "Send a confirmation touch before the meeting window and keep the agenda visible.";
        case "risk_flagged":
          return "Treat this as a same-day rescue: manually confirm attendance and tighten the reminder path.";
      }
    case "completed":
      return "Capture outcomes, next steps, and any learning signals from the meeting.";
    case "canceled":
      return "Offer fresh times quickly so the account does not fall out of the pipeline.";
    case "no_show":
      return "Send a same-day recovery note and propose a lower-friction reschedule option.";
  }
}

function getAppointmentNotes(record: AppointmentRecord) {
  const items = [
    record.appointment.notes ?? "",
    ...(record.contact?.notes ?? []),
    ...(record.company?.painSignals ?? []),
    ...record.relatedNotes.map((entry) => `${entry.title}: ${entry.summary}`),
  ].filter(Boolean);

  return Array.from(new Set(items)).slice(0, 6);
}

function getAppointmentInsights(record: AppointmentRecord) {
  const items = record.relatedInsights.map(
    (insight) => `${insight.title}: ${insight.summary}`,
  );

  return Array.from(new Set(items)).slice(0, 4);
}

function matchesWindow(scheduledFor: string, filter: string) {
  if (filter === "all") {
    return true;
  }

  const scheduledAt = new Date(scheduledFor);
  const hoursAhead = (scheduledAt.getTime() - operationsNow.getTime()) / (60 * 60 * 1000);

  switch (filter) {
    case "today":
      return isSameCalendarDay(scheduledAt, operationsNow);
    case "next_7d":
      return hoursAhead >= 0 && hoursAhead <= 24 * 7;
    case "later":
      return hoursAhead > 24 * 7;
    default:
      return true;
  }
}

function matchesSearch(record: AppointmentRecord, search: string) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  const haystack = [
    record.company?.name ?? "",
    getMarketLabel(record.company),
    getContactName(record.contact),
    getContactRoleLabel(record.contact),
    record.contact?.email ?? "",
    record.campaign?.name ?? "",
    record.offer?.name ?? "",
    record.appointment.notes ?? "",
    record.reply?.snippet ?? "",
    record.reply?.bodyText ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function getStatusOptions(records: AppointmentRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All statuses" },
      { value: "scheduled", label: "Scheduled" },
      { value: "proposed", label: "Proposed" },
      { value: "completed", label: "Completed" },
      { value: "canceled", label: "Canceled" },
      { value: "no_show", label: "No-show" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.appointment.status === value).length,
  );
}

function getCampaignOptions(records: AppointmentRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All campaigns" },
      ...dataAccess.campaigns.list().map((campaign) => ({
        value: campaign.id,
        label: campaign.name,
      })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.appointment.campaignId === value).length,
  );
}

function getOfferOptions(records: AppointmentRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All offers" },
      ...dataAccess.offers.list().map((offer) => ({
        value: offer.id,
        label: offer.name,
      })),
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.offer?.id === value).length,
  );
}

function getConfirmationOptions(records: AppointmentRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All confirmation states" },
      { value: "confirmed", label: "Confirmed" },
      { value: "pending", label: "Pending" },
      { value: "risk_flagged", label: "No-show risk" },
    ],
    (value) =>
      value === "all"
        ? records.length
        : records.filter((record) => record.appointment.confirmationStatus === value).length,
  );
}

function getWindowOptions(records: AppointmentRecord[]) {
  return makeCountedOptions(
    [
      { value: "all", label: "All windows" },
      { value: "today", label: "Today" },
      { value: "next_7d", label: "Next 7 days" },
      { value: "later", label: "Later" },
    ],
    (value) => records.filter((record) => matchesWindow(record.appointment.scheduledFor, value)).length,
  );
}

function buildPipelineStats(records: AppointmentRecord[]): WorkspaceStat[] {
  const upcoming = records.filter((record) => {
    const scheduledAt = new Date(record.appointment.scheduledFor);

    return (
      ["scheduled", "proposed"].includes(record.appointment.status) &&
      scheduledAt.getTime() >= operationsNow.getTime()
    );
  });
  const bookedToday = records.filter((record) =>
    isSameCalendarDay(new Date(record.appointment.bookedAt), operationsNow),
  ).length;
  const pendingOrRisk = upcoming.filter(
    (record) => record.appointment.confirmationStatus !== "confirmed",
  ).length;
  const attributedCampaigns = new Set(records.map((record) => record.appointment.campaignId));
  const offerCounts = new Map<string, { name: string; count: number }>();

  for (const record of records) {
    if (!record.offer) {
      continue;
    }

    offerCounts.set(record.offer.id, {
      name: record.offer.name,
      count: (offerCounts.get(record.offer.id)?.count ?? 0) + 1,
    });
  }

  const topOffer = [...offerCounts.values()].sort((left, right) => right.count - left.count)[0];

  return [
    {
      label: "Booked today",
      value: String(bookedToday),
      detail: "Meetings booked on March 23, 2026 that should stay visible to operators.",
      tone: bookedToday > 0 ? "positive" : "neutral",
    },
    {
      label: "Upcoming appointments",
      value: String(upcoming.length),
      detail: "Scheduled or proposed meetings still ahead of the operating clock.",
      tone: "positive",
    },
    {
      label: "Pending / at risk",
      value: String(pendingOrRisk),
      detail: "Meetings that still need confirmation or a manual save before they happen.",
      tone: pendingOrRisk > 0 ? "warning" : "neutral",
    },
    {
      label: "Attributed campaigns",
      value: String(attributedCampaigns.size),
      detail: "Distinct campaigns currently sourcing meetings into the booking pipeline.",
      tone: "neutral",
    },
    {
      label: "Offer mix",
      value: String(offerCounts.size),
      change: topOffer ? `${topOffer.name} ${topOffer.count}` : "No offer mix",
      detail: "Distinct offers represented in the near-term appointment pipeline.",
      tone: "neutral",
    },
  ];
}

function buildAppointmentDetailView(record: AppointmentRecord): AppointmentDetailView {
  return {
    appointmentId: record.appointment.id,
    companyName: record.company?.name ?? "Unknown company",
    market: getMarketLabel(record.company),
    contactName: getContactName(record.contact),
    contactRole: getContactRoleLabel(record.contact),
    contactEmail: record.contact?.email ?? "Email unavailable",
    campaignName: record.campaign?.name ?? "Campaign unavailable",
    offerName: record.offer?.name ?? "Offer unavailable",
    icpLabel: getIcpLabel(record.company),
    sequenceContext: getSequenceContext(record),
    statusBadge: getStatusBadge(record.appointment.status),
    confirmationBadge: getConfirmationBadge(record.appointment.confirmationStatus),
    scheduledForLabel: formatDateTime(record.appointment.scheduledFor),
    bookedAtLabel: formatDateTime(record.appointment.bookedAt),
    recommendedFollowUpStep: deriveAppointmentNextAction(record),
    basics: [
      {
        label: "Booked at",
        value: formatDateTime(record.appointment.bookedAt),
      },
      {
        label: "Scheduled for",
        value: formatDateTime(record.appointment.scheduledFor),
      },
      {
        label: "Timezone",
        value: record.appointment.timezone,
      },
      {
        label: "Enrollment state",
        value: record.enrollment ? formatLabel(record.enrollment.state) : "No enrollment",
      },
    ],
    sourceContext: [
      {
        label: "Campaign source",
        value: record.campaign?.name ?? "Campaign unavailable",
      },
      {
        label: "Offer",
        value: record.offer?.name ?? "Offer unavailable",
      },
      {
        label: "ICP",
        value: getIcpLabel(record.company),
      },
      {
        label: "Sequence context",
        value: getSequenceContext(record),
      },
    ],
    notes: getAppointmentNotes(record),
    insights: getAppointmentInsights(record),
    sourceReply: record.reply
      ? {
          classificationBadge: getReplyClassificationBadge(record.reply.classification),
          receivedAtLabel: formatDateTime(record.reply.receivedAt),
          preview: record.reply.snippet,
          bodyText: record.reply.bodyText,
        }
      : undefined,
  };
}

export function getAppointmentDetailView(appointmentId: Appointment["id"]) {
  const record = listAppointmentRecords().find(
    (candidate) => candidate.appointment.id === appointmentId,
  );

  return record ? buildAppointmentDetailView(record) : undefined;
}

export function getAppointmentsWorkspaceView(
  searchParams: SearchParamsInput,
): AppointmentsWorkspaceView {
  const filters: AppointmentsWorkspaceFilters = {
    q: readSearchParam(searchParams.q).trim(),
    status: readSearchParam(searchParams.status) || "all",
    campaign: readSearchParam(searchParams.campaign) || "all",
    offer: readSearchParam(searchParams.offer) || "all",
    confirmation: readSearchParam(searchParams.confirmation) || "all",
    window: readSearchParam(searchParams.window) || "all",
    appointmentId: readSearchParam(searchParams.appointmentId),
  };

  const records = listAppointmentRecords();
  const filteredRecords = records.filter((record) => {
    return (
      matchesSearch(record, filters.q) &&
      (filters.status === "all" || record.appointment.status === filters.status) &&
      (filters.campaign === "all" || record.appointment.campaignId === filters.campaign) &&
      (filters.offer === "all" || record.offer?.id === filters.offer) &&
      (filters.confirmation === "all" ||
        record.appointment.confirmationStatus === filters.confirmation) &&
      matchesWindow(record.appointment.scheduledFor, filters.window)
    );
  });

  const selectedRecord =
    filteredRecords.find((record) => record.appointment.id === filters.appointmentId) ??
    filteredRecords[0];

  const rows = filteredRecords.map((record) => ({
    appointmentId: record.appointment.id,
    companyName: record.company?.name ?? "Unknown company",
    contactName: getContactName(record.contact),
    market: getMarketLabel(record.company),
    scheduledForLabel: `${formatDateTime(record.appointment.scheduledFor)} • ${record.appointment.timezone}`,
    statusBadge: getStatusBadge(record.appointment.status),
    confirmationBadge: getConfirmationBadge(record.appointment.confirmationStatus),
    campaignName: record.campaign?.name ?? "Campaign unavailable",
    offerName: record.offer?.name ?? "Offer unavailable",
    nextAction: deriveAppointmentNextAction(record),
  }));

  const filterQuery = cleanQuery({
    q: filters.q,
    status: filters.status !== "all" ? filters.status : "",
    campaign: filters.campaign !== "all" ? filters.campaign : "",
    offer: filters.offer !== "all" ? filters.offer : "",
    confirmation: filters.confirmation !== "all" ? filters.confirmation : "",
    window: filters.window !== "all" ? filters.window : "",
  });

  const query = cleanQuery({
    ...filterQuery,
    appointmentId: selectedRecord?.appointment.id ?? "",
  });

  return {
    stats: buildPipelineStats(filteredRecords),
    filters: {
      values: filters,
      statusOptions: getStatusOptions(records),
      campaignOptions: getCampaignOptions(records),
      offerOptions: getOfferOptions(records),
      confirmationOptions: getConfirmationOptions(records),
      windowOptions: getWindowOptions(records),
    },
    rows,
    selectedAppointment: selectedRecord
      ? buildAppointmentDetailView(selectedRecord)
      : undefined,
    query,
    hasActiveFilters: Object.keys(filterQuery).length > 0,
    resultLabel:
      filteredRecords.length === 1
        ? "1 appointment in view"
        : `${filteredRecords.length} appointments in view`,
    emptyState: {
      title: "No appointments match the current pipeline filters",
      description:
        "Widen the status, confirmation, or date-window filters to bring more meetings back into the pipeline view.",
    },
  };
}
