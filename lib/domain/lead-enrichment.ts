import type {
  CompanyEnrichmentSnapshot,
} from "@/lib/domain/company";
import type {
  CompanyId,
  ContactId,
} from "@/lib/domain/shared";
import type { ContactQualityTier } from "@/lib/domain/contact";
import type { CompanyOutreachAngleSnapshot } from "@/lib/domain/company";

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
  "blocked",
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
  website?: string;
  websiteDiscoveryStatus?: NonNullable<
    CompanyEnrichmentSnapshot["websiteDiscovery"]
  >["status"];
  websiteDiscoverySummary?: string;
  noteHintSummary?: string;
  segmentLabel?: string;
  angleLabel?: string;
  angleReason?: string;
  angleUrgency?: CompanyOutreachAngleSnapshot["urgency"];
  angleConfidenceLevel?: CompanyOutreachAngleSnapshot["confidenceLevel"];
  angleReviewPath?: CompanyOutreachAngleSnapshot["reviewPath"];
  recommendedFirstOfferId?: CompanyOutreachAngleSnapshot["recommendedFirstOfferId"];
  importedAt?: string;
  lastEnrichedAt?: string;
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
  blockedCount: number;
  results: LeadEnrichmentRecordResult[];
}
