import type {
  CompanyEnrichmentSnapshot,
} from "@/lib/domain/company";
import type {
  CompanyId,
  ContactId,
} from "@/lib/domain/shared";
import type { ContactQualityTier } from "@/lib/domain/contact";

export const leadEnrichmentQueueStates = [
  "ready",
  "needs_enrichment",
  "needs_review",
  "blocked",
] as const;
export type LeadEnrichmentQueueState =
  (typeof leadEnrichmentQueueStates)[number];

export const leadEnrichmentRunScopes = [
  "single",
  "selected",
  "queue",
] as const;
export type LeadEnrichmentRunScope = (typeof leadEnrichmentRunScopes)[number];

export const leadEnrichmentResultStatuses = [
  "ready",
  "needs_review",
  "needs_enrichment",
  "failed",
] as const;
export type LeadEnrichmentResultStatus =
  (typeof leadEnrichmentResultStatuses)[number];

export interface LeadEnrichmentRecordResult {
  companyId: CompanyId;
  companyName: string;
  status: LeadEnrichmentResultStatus;
  message: string;
  confidenceLevel: CompanyEnrichmentSnapshot["confidenceLevel"];
  missingFields: string[];
  foundEmails: string[];
  foundPhones: string[];
  pagesChecked: string[];
  primaryContactId?: ContactId;
  primaryContactLabel?: string;
  primaryContactSource?: string;
  primaryContactQuality?: ContactQualityTier;
  qualityWarnings: string[];
  readinessReason: string;
}

export interface LeadEnrichmentRunSummary {
  scope: LeadEnrichmentRunScope;
  processedCount: number;
  updatedCount: number;
  failedCount: number;
  readyCount: number;
  needsReviewCount: number;
  stillNeedsEnrichmentCount: number;
  results: LeadEnrichmentRecordResult[];
}
