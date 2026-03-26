import type {
  AppointmentId,
  AuditFields,
  CampaignId,
  CompanyId,
  CompanyStatus,
  ContactId,
  IcpProfileId,
  IsoDateString,
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

export const enrichmentConfidenceLevels = [
  "none",
  "low",
  "medium",
  "high",
] as const;
export type EnrichmentConfidenceLevel =
  (typeof enrichmentConfidenceLevels)[number];

export const enrichmentContactPaths = [
  "none",
  "phone_only",
  "role_inbox",
  "named_contact",
] as const;
export type EnrichmentContactPath = (typeof enrichmentContactPaths)[number];

export const enrichmentSources = [
  "record_only",
  "public_website",
  "public_website_and_record",
] as const;
export type EnrichmentSource = (typeof enrichmentSources)[number];

export const websiteDiscoveryStatuses = [
  "not_checked",
  "record_provided",
  "discovered",
  "not_found",
  "failed",
] as const;
export type WebsiteDiscoveryStatus =
  (typeof websiteDiscoveryStatuses)[number];

export const websiteDiscoveryConfirmationStatuses = [
  "record_provided",
  "auto_confirmed",
  "operator_confirmed",
  "needs_review",
  "rejected",
  "not_found",
  "failed",
] as const;
export type WebsiteDiscoveryConfirmationStatus =
  (typeof websiteDiscoveryConfirmationStatuses)[number];

export const websiteDiscoveryReviewDecisionStates = [
  "accepted",
  "rejected",
] as const;
export type WebsiteDiscoveryReviewDecisionState =
  (typeof websiteDiscoveryReviewDecisionStates)[number];

export const preferredSupportingPageSources = [
  "discovery",
  "operator_confirmed",
] as const;
export type PreferredSupportingPageSource =
  (typeof preferredSupportingPageSources)[number];

export const companyNoteHintKinds = [
  "website",
  "email",
  "phone",
  "contact_name",
  "contact_title",
  "observation",
] as const;
export type CompanyNoteHintKind = (typeof companyNoteHintKinds)[number];

export const companySegmentKeys = [
  "core_reviews_pain",
  "strong_review_profile",
  "provider_replacement",
  "naps_listing",
  "control_reporting",
] as const;
export type CompanySegmentKey = (typeof companySegmentKeys)[number];

export const companyOutreachAngleKeys = [
  "review_growth_opportunity",
  "review_response_routing_issue",
  "strong_review_optimization_opportunity",
  "provider_replacement_opportunity",
  "naps_listing_consistency_opportunity",
  "control_reporting_opportunity",
  "generic_manual_review",
] as const;
export type CompanyOutreachAngleKey =
  (typeof companyOutreachAngleKeys)[number];

export const companyOutreachAngleUrgencies = [
  "low",
  "medium",
  "high",
] as const;
export type CompanyOutreachAngleUrgency =
  (typeof companyOutreachAngleUrgencies)[number];

export const companyOutreachAngleReviewPaths = [
  "campaign_review",
  "manual_review",
] as const;
export type CompanyOutreachAngleReviewPath =
  (typeof companyOutreachAngleReviewPaths)[number];

export interface CompanyWebsiteDiscoverySnapshot {
  status: WebsiteDiscoveryStatus;
  confirmationStatus: WebsiteDiscoveryConfirmationStatus;
  confirmationReason?: string;
  confidenceLevel: EnrichmentConfidenceLevel;
  confidenceScore: number;
  discoveredWebsite?: string;
  candidateWebsite?: string;
  candidateUrls: string[];
  matchedSignals: string[];
  supportingPageUrls: string[];
  contactPageUrls: string[];
  staffPageUrls: string[];
  extractedEvidence: string[];
  preferredSupportingPage?: {
    url: string;
    kind: "contact" | "about" | "staff";
    source: PreferredSupportingPageSource;
    reason: string;
    updatedAt?: IsoDateString;
  };
  operatorReview?: {
    status: WebsiteDiscoveryReviewDecisionState;
    officialWebsite?: string;
    note?: string;
    reviewedAt?: IsoDateString;
    source: SourceReference;
  };
  source: SourceReference;
  lastCheckedAt?: IsoDateString;
  lastError?: string;
}

export interface CompanyNoteHint {
  kind: CompanyNoteHintKind;
  value: string;
  relatedValue?: string;
  confidenceScore: number;
  requiresReview: boolean;
  source: SourceReference;
}

export interface CompanySegmentSnapshot {
  key: CompanySegmentKey;
  label: string;
  angle: string;
  reasons: string[];
  confidenceLevel: EnrichmentConfidenceLevel;
  updatedAt?: IsoDateString;
}

export interface CompanyOutreachAngleSnapshot {
  key: CompanyOutreachAngleKey;
  label: string;
  shortReason: string;
  recommendedFirstOfferId: OfferId;
  urgency: CompanyOutreachAngleUrgency;
  confidenceLevel: EnrichmentConfidenceLevel;
  confidenceScore: number;
  reviewPath: CompanyOutreachAngleReviewPath;
  reasons: string[];
  updatedAt?: IsoDateString;
}

export interface CompanyEnrichmentSnapshot {
  confidenceLevel: EnrichmentConfidenceLevel;
  confidenceScore: number;
  contactPath: EnrichmentContactPath;
  enrichmentSource: EnrichmentSource;
  sourceUrls: string[];
  pagesChecked: string[];
  foundEmails: string[];
  foundPhones: string[];
  foundNames: string[];
  websiteDiscovery?: CompanyWebsiteDiscoverySnapshot;
  noteHints: CompanyNoteHint[];
  segment?: CompanySegmentSnapshot;
  outreachAngle?: CompanyOutreachAngleSnapshot;
  descriptionSnippet?: string;
  missingFields: string[];
  manualReviewRequired: boolean;
  linkedinVerificationNeeded: boolean;
  linkedinVerified: boolean;
  lastEnrichedAt?: IsoDateString;
  lastAttemptedAt?: IsoDateString;
  lastError?: string;
}

export interface CompanyPresence {
  hasWebsite: boolean;
  websiteUrl?: string;
  primaryPhone?: string;
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
  subindustry?: string;
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
  notes?: string[];
  recommendedOfferIds: OfferId[];
  primaryContactId?: ContactId;
  activeCampaignIds: CampaignId[];
  appointmentIds: AppointmentId[];
  scoring: CompanyScoringSnapshot;
  enrichment?: CompanyEnrichmentSnapshot;
  source: SourceReference;
}
