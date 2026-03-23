import type {
  AuditFields,
  ChannelKind,
  OfferId,
  PriorityTier,
  SequenceId,
  SequenceStatus,
} from "@/lib/domain/shared";

export const sequenceStepTypes = ["email"] as const;
export type SequenceStepType = (typeof sequenceStepTypes)[number];

export interface SequenceStep {
  id: string;
  order: number;
  type: SequenceStepType;
  channel: ChannelKind;
  delayDays: number;
  subjectTemplateKey: string;
  bodyTemplateKey: string;
  subject: string;
  bodyPreview: string;
  goal: string;
  cta: string;
}

export interface Sequence extends AuditFields {
  id: SequenceId;
  name: string;
  lineageKey: string;
  version: number;
  offerId: OfferId;
  status: SequenceStatus;
  targetTier: PriorityTier;
  audienceSummary: string;
  goal: string;
  steps: SequenceStep[];
}
