import type {
  Company,
  Contact,
  Insight,
  MemoryEntry,
  Sequence,
} from "@/lib/domain";
import { getDataAccess } from "@/lib/data/access";

const dataAccess = getDataAccess();

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
}

export interface PriorityLeadRow {
  companyId: string;
  companyName: string;
  market: string;
  offerName: string;
  decisionMakerLabel: string;
  confidenceLabel: string;
  nextStep: string;
}

export interface SequenceHealthRow {
  sequenceId: string;
  name: string;
  segment: string;
  enrolledCount: string;
  replyRate: string;
  bookedCount: string;
}

export interface DashboardSignal {
  id: string;
  title: string;
  tag: string;
  summary: string;
}

export interface DashboardBlocker {
  id: string;
  title: string;
  summary: string;
}

export interface DashboardView {
  stats: DashboardStat[];
  priorityLeads: PriorityLeadRow[];
  sequenceHealth: SequenceHealthRow[];
  learningSignals: DashboardSignal[];
  blockers: DashboardBlocker[];
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return "0.0%";
  }

  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatTierLabel(tier: Company["priorityTier"]) {
  return tier.replace("_", " ").toUpperCase();
}

function formatInsightTag(type: Insight["type"]) {
  return type.replace("_", " ");
}

function formatRoleLabel(contact: Contact) {
  const name = contact.fullName ?? "Unknown contact";
  const title = contact.title ?? contact.role.replace("_", " ");

  return `${name} • ${title}`;
}

function formatConfidence(score: number) {
  return `Confidence ${score.toFixed(2)}`;
}

function getNextStep(company: Company) {
  switch (company.status) {
    case "campaign_ready":
      return "Review sequence enrollment and finalize opener";
    case "qualified":
      return "Validate contact and offer before enrollment";
    case "enriched":
      return "Complete scoring and promote to qualified";
    case "new":
      return "Run enrichment pass";
    default:
      return "Monitor account status";
  }
}

function getPriorityLeads(): PriorityLeadRow[] {
  const companies = dataAccess.companies
    .list()
    .filter(
      (company) =>
        company.status !== "disqualified" && company.status !== "customer",
    )
    .sort((left, right) => {
      const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 } as const;

      return (
        tierOrder[left.priorityTier] - tierOrder[right.priorityTier] ||
        right.scoring.fitScore - left.scoring.fitScore
      );
    })
    .slice(0, 3);

  return companies.map((company) => {
    const offer = company.recommendedOfferIds
      .map((offerId) => dataAccess.offers.getById(offerId))
      .find(Boolean);
    const contact = company.primaryContactId
      ? dataAccess.contacts.getById(company.primaryContactId)
      : undefined;

    return {
      companyId: company.id,
      companyName: company.name,
      market: `${company.location.city}, ${company.location.state}`,
      offerName: offer?.name ?? "Offer pending",
      decisionMakerLabel: contact ? formatRoleLabel(contact) : "Hypothesis pending",
      confidenceLabel: contact
        ? formatConfidence(contact.confidence.score)
        : "Confidence pending",
      nextStep: getNextStep(company),
    };
  });
}

function getSequenceHealth(): SequenceHealthRow[] {
  return dataAccess.sequences.listByStatus("active").map((sequence: Sequence) => {
    const enrollments = dataAccess.enrollments.listBySequenceId(sequence.id);
    const enrollmentIds = new Set(enrollments.map((enrollment) => enrollment.id));
    const replies = dataAccess
      .replies
      .list()
      .filter((reply) => enrollmentIds.has(reply.enrollmentId));
    const bookedAppointments = dataAccess
      .appointments
      .list()
      .filter((appointment) => enrollmentIds.has(appointment.enrollmentId));

    return {
      sequenceId: sequence.id,
      name: sequence.name,
      segment: `${formatTierLabel(sequence.targetTier)} / ${sequence.audienceSummary}`,
      enrolledCount: String(enrollments.length),
      replyRate: formatPercent(replies.length, enrollments.length),
      bookedCount: String(bookedAppointments.length),
    };
  });
}

function getLearningSignals(): DashboardSignal[] {
  return dataAccess.insights.list().slice(0, 3).map((insight) => ({
    id: insight.id,
    title: insight.title,
    tag: formatInsightTag(insight.type),
    summary: insight.summary,
  }));
}

function getBlockers(): DashboardBlocker[] {
  return dataAccess
    .memoryEntries
    .list()
    .filter((entry: MemoryEntry) => entry.kind === "constraint")
    .slice(0, 2)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      summary: entry.summary,
    }));
}

function getStats(): DashboardStat[] {
  const companies = dataAccess.companies.list();
  const activeSequences = dataAccess.sequences.listByStatus("active").length;
  const positiveReplies = dataAccess.replies.listByClassification("positive").length;
  const appointmentsToday = dataAccess
    .appointments
    .list()
    .filter((appointment) => appointment.scheduledFor.startsWith("2026-03-23")).length;
  const tierOneQueued = companies.filter(
    (company) =>
      company.priorityTier === "tier_1" &&
      (company.status === "qualified" || company.status === "campaign_ready"),
  ).length;

  return [
    {
      label: "Tier 1 dealers queued",
      value: String(tierOneQueued),
      change: `${tierOneQueued} active now`,
      detail:
        "Best-fit independent dealers that are already qualified or ready for campaign review.",
      tone: "positive",
    },
    {
      label: "Active sequences",
      value: String(activeSequences).padStart(2, "0"),
      change: "Email-first",
      detail:
        "Live sequence shells currently backed by typed campaign, enrollment, and offer records.",
      tone: "neutral",
    },
    {
      label: "Positive replies",
      value: String(positiveReplies),
      change: `${formatPercent(
        positiveReplies,
        dataAccess.enrollments.list().length,
      )} positive rate`,
      detail:
        "Reply classifications now flow through a typed contract instead of a loose dashboard stub.",
      tone: "positive",
    },
    {
      label: "Appointments today",
      value: String(appointmentsToday),
      change: "Goal: 5/day",
      detail:
        "The operating target stays visible so the product keeps optimizing for booked meetings, not just activity.",
      tone: "warning",
    },
  ];
}

export function getDashboardView(): DashboardView {
  return {
    stats: getStats(),
    priorityLeads: getPriorityLeads(),
    sequenceHealth: getSequenceHealth(),
    learningSignals: getLearningSignals(),
    blockers: getBlockers(),
  };
}
