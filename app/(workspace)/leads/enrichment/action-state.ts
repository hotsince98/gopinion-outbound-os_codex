import type { LeadEnrichmentRunSummary } from "@/lib/domain";

export interface LeadEnrichmentActionState {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: LeadEnrichmentRunSummary;
}

export const initialLeadEnrichmentActionState: LeadEnrichmentActionState = {
  status: "idle",
};
