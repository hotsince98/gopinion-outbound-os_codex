import type {
  AuditFields,
  MemoryEntryId,
  MemoryEntryKind,
  RelatedEntityKind,
} from "@/lib/domain/shared";

export interface MemoryEntry extends AuditFields {
  id: MemoryEntryId;
  kind: MemoryEntryKind;
  title: string;
  summary: string;
  relatedEntityType?: RelatedEntityKind;
  relatedEntityId?: string;
  tags: string[];
  lastObservedAt?: string;
}
