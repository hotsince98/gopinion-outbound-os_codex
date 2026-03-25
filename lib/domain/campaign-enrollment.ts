import type {
  CampaignId,
  CampaignStatus,
  CompanyId,
  ContactId,
  EnrollmentId,
  IsoDateString,
  OfferId,
  SequenceId,
} from "@/lib/domain/shared";
import type { EnrichmentConfidenceLevel } from "@/lib/domain/company";
import type {
  ContactPathKind,
  ContactQualityTier,
} from "@/lib/domain/contact";

export const campaignEnrollmentDecisions = [
  "enroll_now",
  "review_before_enrollment",
  "blocked",
] as const;
export type CampaignEnrollmentDecision =
  (typeof campaignEnrollmentDecisions)[number];

export const campaignEnrollmentModes = ["assign", "enroll"] as const;
export type CampaignEnrollmentMode = (typeof campaignEnrollmentModes)[number];

export const campaignEnrollmentResultStatuses = [
  "assigned",
  "enrolled",
  "review",
  "blocked",
  "failed",
] as const;
export type CampaignEnrollmentResultStatus =
  (typeof campaignEnrollmentResultStatuses)[number];

export interface CampaignAssignmentRecommendation {
  companyId: CompanyId;
  decision: CampaignEnrollmentDecision;
  decisionReason: string;
  blockedReason?: string;
  manualReviewRequired: boolean;
  campaignReviewRequired: boolean;
  confidenceLevel: EnrichmentConfidenceLevel;
  recommendedCampaignId?: CampaignId;
  recommendedCampaignName?: string;
  recommendedCampaignStatus?: CampaignStatus;
  recommendedOfferId?: OfferId;
  recommendedOfferName?: string;
  recommendedSequenceId?: SequenceId;
  primaryContactId?: ContactId;
  primaryContactLabel: string;
  primaryContactSource: string;
  primaryContactQuality: string;
  primaryContactWarnings: string[];
  contactPathKind?: ContactPathKind;
  contactQualityTier?: ContactQualityTier;
  contactCampaignEligible: boolean;
  angleLabel: string;
  angleReason: string;
}

export interface CampaignEnrollmentRecordResult {
  companyId: CompanyId;
  companyName: string;
  status: CampaignEnrollmentResultStatus;
  message: string;
  decision: CampaignEnrollmentDecision;
  campaignId?: CampaignId;
  campaignName?: string;
  enrollmentId?: EnrollmentId;
  primaryContactLabel?: string;
  primaryContactSource?: string;
  primaryContactQuality?: string;
  warnings: string[];
}

export interface CampaignEnrollmentRunSummary {
  requestedCount: number;
  assignedCount: number;
  enrolledCount: number;
  reviewCount: number;
  blockedCount: number;
  failedCount: number;
  mode: CampaignEnrollmentMode;
  processedAt: IsoDateString;
  results: CampaignEnrollmentRecordResult[];
}
