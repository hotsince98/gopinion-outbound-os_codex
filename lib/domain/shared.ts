export type IsoDateString = string;

export type CompanyId = `company_${string}`;
export type ContactId = `contact_${string}`;
export type OfferId = `offer_${string}`;
export type CampaignId = `campaign_${string}`;
export type SequenceId = `sequence_${string}`;
export type EnrollmentId = `enrollment_${string}`;
export type ReplyId = `reply_${string}`;
export type AppointmentId = `appointment_${string}`;
export type ExperimentId = `experiment_${string}`;
export type InsightId = `insight_${string}`;
export type MemoryEntryId = `memory_${string}`;
export type IcpProfileId = `icp_${string}`;

export const priorityTiers = ["tier_1", "tier_2", "tier_3"] as const;
export type PriorityTier = (typeof priorityTiers)[number];

export const companyStatuses = [
  "new",
  "enriched",
  "qualified",
  "campaign_ready",
  "customer",
  "disqualified",
] as const;
export type CompanyStatus = (typeof companyStatuses)[number];

export const campaignStatuses = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];

export const sequenceStatuses = ["draft", "active", "paused", "retired"] as const;
export type SequenceStatus = (typeof sequenceStatuses)[number];

export const enrollmentStates = [
  "pending",
  "active",
  "waiting",
  "replied",
  "booked",
  "completed",
  "paused",
  "failed",
] as const;
export type EnrollmentState = (typeof enrollmentStates)[number];

export const replyClassifications = [
  "positive",
  "objection",
  "not_now",
  "not_interested",
  "wrong_person",
  "out_of_office",
  "bounced",
  "unsubscribe",
  "unknown",
] as const;
export type ReplyClassification = (typeof replyClassifications)[number];

export const replySentiments = [
  "positive",
  "neutral",
  "mixed",
  "negative",
] as const;
export type ReplySentiment = (typeof replySentiments)[number];

export const offerCategories = ["reviews_reputation", "naps"] as const;
export type OfferCategory = (typeof offerCategories)[number];

export const insightTypes = [
  "offer_fit",
  "decision_maker",
  "campaign_performance",
  "reply_pattern",
  "icp_signal",
  "scope",
] as const;
export type InsightType = (typeof insightTypes)[number];

export const contactRoles = [
  "owner",
  "operator_owner",
  "general_manager",
  "dealership_manager",
  "sales_manager",
  "unknown",
] as const;
export type ContactRole = (typeof contactRoles)[number];

export const contactStatuses = [
  "candidate",
  "verified",
  "invalid",
  "do_not_contact",
] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export const contactSourceKinds = ["observed", "inferred"] as const;
export type ContactSourceKind = (typeof contactSourceKinds)[number];

export const sourceKinds = [
  "manual",
  "import",
  "mock",
  "provider",
  "system_inference",
] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const appointmentStatuses = [
  "proposed",
  "scheduled",
  "completed",
  "canceled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentConfirmationStatuses = [
  "pending",
  "confirmed",
  "risk_flagged",
] as const;
export type AppointmentConfirmationStatus =
  (typeof appointmentConfirmationStatuses)[number];

export const experimentStatuses = [
  "draft",
  "running",
  "completed",
  "paused",
] as const;
export type ExperimentStatus = (typeof experimentStatuses)[number];

export const memoryEntryKinds = [
  "system_learning",
  "operator_note",
  "playbook",
  "constraint",
] as const;
export type MemoryEntryKind = (typeof memoryEntryKinds)[number];

export const channelKinds = ["email"] as const;
export type ChannelKind = (typeof channelKinds)[number];

export const relatedEntityKinds = [
  "company",
  "contact",
  "offer",
  "campaign",
  "sequence",
  "enrollment",
  "reply",
  "appointment",
  "experiment",
  "insight",
  "memory_entry",
  "icp_profile",
] as const;
export type RelatedEntityKind = (typeof relatedEntityKinds)[number];

export interface AuditFields {
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface MoneyAmount {
  amountUsd: number;
  cadence: "one_time" | "monthly";
  label?: string;
}

export interface Location {
  city: string;
  state: string;
  country: string;
}

export interface SourceReference {
  kind: SourceKind;
  provider: string;
  label?: string;
  externalId?: string;
  url?: string;
  observedAt?: IsoDateString;
}

export interface ConfidenceIndicator {
  score: number;
  signals: string[];
}
