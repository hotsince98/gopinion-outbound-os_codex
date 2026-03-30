import type {
  Company,
  CompanyId,
  Contact,
  ContactId,
  LatestReviewResponseStatus,
} from "@/lib/domain";

export const supportedLeadIndustryOptions = [
  {
    value: "independent_used_car_dealer" satisfies Company["industryKey"],
    label: "Independent used car dealer",
  },
] as const;

export interface LeadIntakeRecentReviewInput {
  snippet?: string;
  rating?: number;
  author?: string;
  publishedAt?: string;
  responseStatus?: LatestReviewResponseStatus;
}

export interface LeadIntakeInput {
  companyName: string;
  website?: string;
  industryKey: Company["industryKey"];
  subindustry?: string;
  streetAddress?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  phone?: string;
  googleRating?: number;
  reviewCount?: number;
  latestReviewSnippet?: string;
  latestReviewRating?: number;
  latestReviewAuthor?: string;
  latestReviewDate?: string;
  latestReviewResponseStatus?: LatestReviewResponseStatus;
  recentReviews?: LeadIntakeRecentReviewInput[];
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
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  googleRating?: string;
  reviewCount?: string;
  latestReviewSnippet?: string;
  latestReviewRating?: string;
  latestReviewAuthor?: string;
  latestReviewDate?: string;
  latestReviewResponseStatus?: string;
  recentReviews?: string[];
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
  contacts?: Contact[];
}

export interface CsvLeadPreviewRow {
  rowNumber: number;
  companyName: string;
  website?: string;
  marketLabel: string;
  contactLabel: string;
  reviewLabel: string;
  reviewSnippets: string[];
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
