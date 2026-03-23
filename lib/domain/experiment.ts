import type {
  AuditFields,
  ExperimentId,
  ExperimentStatus,
  RelatedEntityKind,
} from "@/lib/domain/shared";

export interface Experiment extends AuditFields {
  id: ExperimentId;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  targetEntityType: RelatedEntityKind;
  targetEntityId?: string;
  primaryMetric: string;
  variantKeys: string[];
  winningVariantKey?: string;
  startedAt?: string;
  endedAt?: string;
}
