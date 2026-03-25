import type {
  AuditFields,
  CompanyId,
  ConfidenceIndicator,
  ContactId,
  ContactRole,
  ContactSourceKind,
  ContactStatus,
  IsoDateString,
  SourceReference,
} from "@/lib/domain/shared";

export const contactQualityTiers = [
  "strong",
  "usable",
  "weak",
  "junk",
] as const;
export type ContactQualityTier = (typeof contactQualityTiers)[number];

export const contactPathKinds = [
  "named_email",
  "role_inbox",
  "general_business_email",
  "phone_only",
  "unknown",
] as const;
export type ContactPathKind = (typeof contactPathKinds)[number];

export interface ContactQualitySnapshot {
  rankScore: number;
  selectionScore?: number;
  selectionRank?: number;
  qualityTier: ContactQualityTier;
  pathKind: ContactPathKind;
  campaignEligible: boolean;
  warnings: string[];
  selectionReasons: string[];
  demotionReasons: string[];
  lastAssessedAt?: IsoDateString;
}

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
  quality?: ContactQualitySnapshot;
  notes: string[];
  source: SourceReference;
}
