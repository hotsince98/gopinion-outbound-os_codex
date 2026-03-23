import type {
  AuditFields,
  CompanyId,
  ConfidenceIndicator,
  ContactId,
  ContactRole,
  ContactSourceKind,
  ContactStatus,
  SourceReference,
} from "@/lib/domain/shared";

export interface Contact extends AuditFields {
  id: ContactId;
  companyId: CompanyId;
  fullName?: string;
  title?: string;
  role: ContactRole;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceKind: ContactSourceKind;
  status: ContactStatus;
  isPrimary: boolean;
  outreachReady: boolean;
  confidence: ConfidenceIndicator;
  notes: string[];
  source: SourceReference;
}
