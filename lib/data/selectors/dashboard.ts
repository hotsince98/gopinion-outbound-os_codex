import type {
  Company,
  Contact,
  Insight,
  MemoryEntry,
  Sequence,
} from "@/lib/domain";
import { buildIdMap, getSelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

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

function getPriorityLeads(
  companies: Company[],
  contactById: Map<string, Contact>,
  offerById: Map<string, { name: string }>,
): PriorityLeadRow[] {
  return companies
    .filter((company) => company.status !== "disqualified" && company.status !== "customer")
    .sort((left, right) => {
      const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 } as const;

      return (
        tierOrder[left.priorityTier] - tierOrder[right.priorityTier] ||
        right.scoring.fitScore - left.scoring.fitScore
      );
    })
    .slice(0, 3)
    .map((company) => {
    const offer = company.recommendedOfferIds
      .map((offerId) => offerById.get(offerId))
      .find(Boolean);
    const contact = company.primaryContactId
      ? contactById.get(company.primaryContactId)
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

function getSequenceHealth(
  sequences: Sequence[],
  enrollments: { sequenceId: string; id: string }[],
  replies: { enrollmentId: string }[],
  appointments: { enrollmentId: string }[],
): SequenceHealthRow[] {
  return sequences
    .filter((sequence) => sequence.status === "active")
    .map((sequence: Sequence) => {
    const sequenceEnrollments = enrollments.filter(
      (enrollment) => enrollment.sequenceId === sequence.id,
    );
    const enrollmentIds = new Set(sequenceEnrollments.map((enrollment) => enrollment.id));
    const sequenceReplies = replies
      .filter((reply) => enrollmentIds.has(reply.enrollmentId));
    const bookedAppointments = appointments
      .filter((appointment) => enrollmentIds.has(appointment.enrollmentId));

    return {
      sequenceId: sequence.id,
      name: sequence.name,
      segment: `${formatTierLabel(sequence.targetTier)} / ${sequence.audienceSummary}`,
      enrolledCount: String(sequenceEnrollments.length),
      replyRate: formatPercent(sequenceReplies.length, sequenceEnrollments.length),
      bookedCount: String(bookedAppointments.length),
    };
  });
}

function getLearningSignals(insights: Insight[]): DashboardSignal[] {
  return insights.slice(0, 3).map((insight) => ({
    id: insight.id,
    title: insight.title,
    tag: formatInsightTag(insight.type),
    summary: insight.summary,
  }));
}

function getBlockers(memoryEntries: MemoryEntry[]): DashboardBlocker[] {
  return memoryEntries
    .filter((entry: MemoryEntry) => entry.kind === "constraint")
    .slice(0, 2)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      summary: entry.summary,
    }));
}

function getStats(
  companies: Company[],
  sequences: Sequence[],
  replies: { classification: string }[],
  appointments: { scheduledFor: string }[],
  enrollmentsCount: number,
): DashboardStat[] {
  const activeSequences = sequences.filter((sequence) => sequence.status === "active").length;
  const positiveReplies = replies.filter((reply) => reply.classification === "positive").length;
  const appointmentsToday = appointments.filter((appointment) =>
    appointment.scheduledFor.startsWith("2026-03-23"),
  ).length;
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
      change: `${formatPercent(positiveReplies, enrollmentsCount)} positive rate`,
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

export async function getDashboardView(): Promise<DashboardView> {
  const snapshot = await getSelectorDataSnapshot();
  const contactById = buildIdMap(snapshot.contacts);
  const offerById = buildIdMap(snapshot.offers);

  return {
    stats: getStats(
      snapshot.companies,
      snapshot.sequences,
      snapshot.replies,
      snapshot.appointments,
      snapshot.enrollments.length,
    ),
    priorityLeads: getPriorityLeads(snapshot.companies, contactById, offerById),
    sequenceHealth: getSequenceHealth(
      snapshot.sequences,
      snapshot.enrollments,
      snapshot.replies,
      snapshot.appointments,
    ),
    learningSignals: getLearningSignals(snapshot.insights),
    blockers: getBlockers(snapshot.memoryEntries),
  };
}
