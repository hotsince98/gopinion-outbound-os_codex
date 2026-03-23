import type {
  ChannelKind,
  IcpProfileId,
  MemoryEntryKind,
  OfferCategory,
  RelatedEntityKind,
} from "@/lib/domain/shared";

export const workflowChannelKeys = [
  "email",
  "manual_research_follow_up",
  "linkedin_workflow",
] as const;
export type WorkflowChannelKey = (typeof workflowChannelKeys)[number];

export const workflowChannelRoles = [
  "primary",
  "supporting",
  "future",
] as const;
export type WorkflowChannelRole = (typeof workflowChannelRoles)[number];

export const workflowChannelStatuses = [
  "configured",
  "operator_assisted",
  "planned",
] as const;
export type WorkflowChannelStatus = (typeof workflowChannelStatuses)[number];

export const workflowApprovalModes = [
  "operator_required",
  "operator_review",
  "recommendation_only",
] as const;
export type WorkflowApprovalMode = (typeof workflowApprovalModes)[number];

export const learningOutcomeKeys = [
  "appointments_booked",
  "positive_replies",
  "objection_patterns",
  "operator_review_gates",
] as const;
export type LearningOutcomeKey = (typeof learningOutcomeKeys)[number];

export const learningTrackingStatuses = ["mock_ready", "planned"] as const;
export type LearningTrackingStatus = (typeof learningTrackingStatuses)[number];

export const integrationKeys = [
  "database",
  "calendly",
  "email_provider",
  "linkedin_workflow",
  "ai_provider",
] as const;
export type IntegrationKey = (typeof integrationKeys)[number];

export const integrationReadinessStatuses = [
  "mock_ready",
  "pending",
  "planned",
] as const;
export type IntegrationReadinessStatus =
  (typeof integrationReadinessStatuses)[number];

export interface IcpControlConfiguration {
  profileId: IcpProfileId;
  targetIndustries: string[];
  targetSubindustries: string[];
  dreamSummary: string;
  tierTwoSummary: string;
  avoidSummary: string;
  preferredChannels: ChannelKind[];
  firstOfferCategory: OfferCategory;
}

export interface WorkflowChannelConfiguration {
  key: WorkflowChannelKey;
  label: string;
  channelKind?: ChannelKind;
  role: WorkflowChannelRole;
  status: WorkflowChannelStatus;
  summary: string;
  objective: string;
  activationNotes: string[];
  approvalMode: WorkflowApprovalMode;
}

export interface LearningOutcomeConfiguration {
  key: LearningOutcomeKey;
  label: string;
  summary: string;
  sourceEntityType: RelatedEntityKind;
  trackingStatus: LearningTrackingStatus;
}

export interface LearningConfiguration {
  summary: string;
  trackedOutcomes: LearningOutcomeConfiguration[];
  optimizationTargets: string[];
  approvalRequiredBehaviors: string[];
  automaticRecommendationBehaviors: string[];
  memoryEntryCategories: MemoryEntryKind[];
}

export interface IntegrationReadinessCheck {
  key: IntegrationKey;
  label: string;
  status: IntegrationReadinessStatus;
  summary: string;
  owner: string;
  nextStep: string;
  blockedBy?: string;
}
