import type {
  Company,
  Contact,
  Insight,
  MemoryEntry,
  Sequence,
} from "@/lib/domain";
import { selectPrimaryContact } from "@/lib/data/contacts/quality";
import { getLatestReviewSignal } from "@/lib/data/selectors/shared";
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

export interface DashboardReviewWatchItem {
  companyId: string;
  companyName: string;
  market: string;
  badgeLabel: string;
  summary: string;
  metaLabel: string;
  snippet?: string;
}

export interface DashboardBlocker {
  id: string;
  title: string;
  summary: string;
}

export interface DashboardView {
  stats: DashboardStat[];
  priorityLeads: PriorityLeadRow[];
  reviewWatchlist: DashboardReviewWatchItem[];
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
  contacts: Contact[],
  offerById: Map<string, { name: string }>,
): PriorityLeadRow[] {
  const contactsByCompanyId = new Map<string, Contact[]>();

  for (const contact of contacts) {
    const existing = contactsByCompanyId.get(contact.companyId) ?? [];

    existing.push(contact);
    contactsByCompanyId.set(contact.companyId, existing);
  }

  return companies
    .filter((company) => company.status !== "disqualified" && company.status !== "customer")
    .sort((left, right) => {
      const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 } as const;
      const latestReviewPriority =
        getLatestReviewSignal(right).priorityRank - getLatestReviewSignal(left).priorityRank;

      if (latestReviewPriority !== 0) {
        return latestReviewPriority;
      }

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
    const contact = selectPrimaryContact(
      contactsByCompanyId.get(company.id) ?? [],
      {
        preferredContactId: company.primaryContactId,
      },
    );

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

function getReviewWatchlist(companies: Company[]) {
  return companies
    .filter((company) => company.status !== "disqualified" && company.status !== "customer")
    .map((company) => ({
      company,
      latestReview: getLatestReviewSignal(company),
    }))
    .filter(({ latestReview }) => latestReview.priorityRank > 0)
    .sort((left, right) => {
      if (right.latestReview.priorityRank !== left.latestReview.priorityRank) {
        return right.latestReview.priorityRank - left.latestReview.priorityRank;
      }

      return right.company.createdAt.localeCompare(left.company.createdAt);
    })
    .slice(0, 4)
    .map(({ company, latestReview }) => ({
      companyId: company.id,
      companyName: company.name,
      market: `${company.location.city}, ${company.location.state}`,
      badgeLabel: latestReview.badge.label,
      summary: latestReview.summary,
      metaLabel: latestReview.metaLabel,
      snippet: latestReview.snippet,
    }));
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
  const reviewAlerts = companies.filter(
    (company) => getLatestReviewSignal(company).filterState === "urgent",
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
      label: "Review alerts",
      value: String(reviewAlerts),
      change: reviewAlerts > 0 ? "Fresh reputation openings" : "No urgent alerts",
      detail:
        "Companies with recent low-star or unanswered review context that should jump the review queue.",
      tone: reviewAlerts > 0 ? "warning" : "neutral",
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
  const offerById = buildIdMap(snapshot.offers);

  return {
    stats: getStats(
      snapshot.companies,
      snapshot.sequences,
      snapshot.replies,
      snapshot.appointments,
      snapshot.enrollments.length,
    ),
    priorityLeads: getPriorityLeads(snapshot.companies, snapshot.contacts, offerById),
    reviewWatchlist: getReviewWatchlist(snapshot.companies),
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
