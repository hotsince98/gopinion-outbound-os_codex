import type {
  AppointmentId,
  AuditFields,
  CampaignId,
  CompanyId,
  CompanyStatus,
  ContactId,
  IcpProfileId,
  Location,
  NumericRange,
  OfferId,
  PriorityTier,
  SourceReference,
} from "@/lib/domain/shared";

export const reviewResponseBands = [
  "none",
  "low",
  "inconsistent",
  "active",
] as const;
export type ReviewResponseBand = (typeof reviewResponseBands)[number];

export const companyBuyingStages = [
  "growth_oriented",
  "pain_aware",
  "solution_aware",
  "pragmatic",
  "unknown",
] as const;
export type CompanyBuyingStage = (typeof companyBuyingStages)[number];

export const leadScoreBuckets = ["high", "medium", "low"] as const;
export type LeadScoreBucket = (typeof leadScoreBuckets)[number];

export interface CompanyPresence {
  hasWebsite: boolean;
  websiteUrl?: string;
  hasClaimedGoogleBusinessProfile: boolean;
  googleBusinessProfileUrl?: string;
  googleRating?: number;
  reviewCount?: number;
  reviewResponseBand: ReviewResponseBand;
}

export interface CompanyScoringSnapshot {
  fitScore: number;
  offerFitScore: number;
  outreachReadinessScore: number;
  bucket: LeadScoreBucket;
  reasons: string[];
}

export interface Company extends AuditFields {
  id: CompanyId;
  name: string;
  legalName?: string;
  industryKey: "independent_used_car_dealer";
  icpProfileId: IcpProfileId;
  status: CompanyStatus;
  priorityTier: PriorityTier;
  isIndependent: boolean;
  monthlyCarsSoldRange?: NumericRange;
  likelyOperatorAgeRange?: NumericRange;
  location: Location;
  presence: CompanyPresence;
  softwareToolCountEstimate?: number;
  buyingStage: CompanyBuyingStage;
  painSignals: string[];
  disqualifierSignals: string[];
  recommendedOfferIds: OfferId[];
  primaryContactId?: ContactId;
  activeCampaignIds: CampaignId[];
  appointmentIds: AppointmentId[];
  scoring: CompanyScoringSnapshot;
  source: SourceReference;
}
