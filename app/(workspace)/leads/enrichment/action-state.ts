import type { LeadEnrichmentRunSummary } from "@/lib/domain";

export interface LeadEnrichmentActionState {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: LeadEnrichmentRunSummary;
}

export const initialLeadEnrichmentActionState: LeadEnrichmentActionState = {
  status: "idle",
};

export interface LeadQueueMutationActionState {
  status: "idle" | "success" | "error";
  message?: string;
  removedCount?: number;
}

export const initialLeadQueueMutationActionState: LeadQueueMutationActionState = {
  status: "idle",
};
