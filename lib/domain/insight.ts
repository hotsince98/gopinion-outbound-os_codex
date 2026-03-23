import type {
  AuditFields,
  InsightId,
  InsightType,
  RelatedEntityKind,
} from "@/lib/domain/shared";

export interface Insight extends AuditFields {
  id: InsightId;
  type: InsightType;
  title: string;
  summary: string;
  confidence: number;
  sourceEntityType: RelatedEntityKind;
  sourceEntityId?: string;
  tags: string[];
}
