import type {
  Company,
  CompanyId,
  Contact,
  ContactId,
} from "@/lib/domain";

export const supportedLeadIndustryOptions = [
  {
    value: "independent_used_car_dealer" satisfies Company["industryKey"],
    label: "Independent used car dealer",
  },
] as const;

export interface LeadIntakeInput {
  companyName: string;
  website?: string;
  industryKey: Company["industryKey"];
  subindustry?: string;
  city: string;
  state: string;
  country: string;
  googleRating?: number;
  reviewCount?: number;
  primaryContactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  notes?: string;
  sourceKind: "manual" | "csv";
}

export interface LeadIntakeFieldErrors {
  companyName?: string;
  website?: string;
  industryKey?: string;
  subindustry?: string;
  city?: string;
  state?: string;
  country?: string;
  googleRating?: string;
  reviewCount?: string;
  primaryContactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  notes?: string;
}

export interface LeadDuplicateCheck {
  companyNameMatch?: Company;
  websiteMatch?: Company;
}

export interface LeadCreationResult {
  company: Company;
  contact?: Contact;
}

export interface CsvLeadPreviewRow {
  rowNumber: number;
  companyName: string;
  website?: string;
  marketLabel: string;
  contactLabel: string;
  issues: string[];
}

export interface CsvLeadColumnMapping {
  header: string;
  mappedField: string;
  strategy: "direct" | "inferred" | "unmapped";
  note?: string;
}

export interface CsvLeadPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedColumns: string[];
  mappedColumns: string[];
  columnMappings: CsvLeadColumnMapping[];
  warnings: string[];
  rows: CsvLeadPreviewRow[];
}

export interface LeadImportSummary {
  createdCompanies: number;
  createdContacts: number;
  duplicateRows: number;
  invalidRows: number;
  createdCompanyIds: CompanyId[];
  createdContactIds: ContactId[];
  notices: string[];
}
