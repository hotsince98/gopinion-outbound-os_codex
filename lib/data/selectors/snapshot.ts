import { getDataAccess } from "@/lib/data/access";
import type { RepositoryResult } from "@/lib/data/core/contracts";
import type {
  Appointment,
  Campaign,
  Company,
  Contact,
  Enrollment,
  Experiment,
  Insight,
  MemoryEntry,
  Offer,
  Reply,
  Sequence,
} from "@/lib/domain";

async function resolveRepositoryResult<T>(
  value: RepositoryResult<T>,
): Promise<T> {
  return await value;
}

export interface SelectorDataSnapshot {
  companies: Company[];
  contacts: Contact[];
  offers: Offer[];
  campaigns: Campaign[];
  sequences: Sequence[];
  enrollments: Enrollment[];
  replies: Reply[];
  appointments: Appointment[];
  experiments: Experiment[];
  insights: Insight[];
  memoryEntries: MemoryEntry[];
}

export function buildIdMap<T extends { id: string }>(items: readonly T[]) {
  return new Map(items.map((item) => [item.id, item] as const));
}

export async function getSelectorDataSnapshot(): Promise<SelectorDataSnapshot> {
  const dataAccess = getDataAccess();
  const [
    companies,
    contacts,
    offers,
    campaigns,
    sequences,
    enrollments,
    replies,
    appointments,
    experiments,
    insights,
    memoryEntries,
  ] = await Promise.all([
    resolveRepositoryResult(dataAccess.companies.list()),
    resolveRepositoryResult(dataAccess.contacts.list()),
    resolveRepositoryResult(dataAccess.offers.list()),
    resolveRepositoryResult(dataAccess.campaigns.list()),
    resolveRepositoryResult(dataAccess.sequences.list()),
    resolveRepositoryResult(dataAccess.enrollments.list()),
    resolveRepositoryResult(dataAccess.replies.list()),
    resolveRepositoryResult(dataAccess.appointments.list()),
    resolveRepositoryResult(dataAccess.experiments.list()),
    resolveRepositoryResult(dataAccess.insights.list()),
    resolveRepositoryResult(dataAccess.memoryEntries.list()),
  ]);

  return {
    companies,
    contacts,
    offers,
    campaigns,
    sequences,
    enrollments,
    replies,
    appointments,
    experiments,
    insights,
    memoryEntries,
  };
}
