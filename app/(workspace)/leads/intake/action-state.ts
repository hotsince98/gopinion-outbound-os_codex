import type {
  LeadImportSummary,
  LeadIntakeFieldErrors,
} from "@/lib/domain";

export interface ManualLeadActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: LeadIntakeFieldErrors;
  duplicateMessages?: string[];
  createdCompanyId?: string;
  createdCompanyName?: string;
}

export interface CsvLeadImportActionState {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: LeadImportSummary;
}

export const initialManualLeadActionState: ManualLeadActionState = {
  status: "idle",
};

export const initialCsvLeadImportActionState: CsvLeadImportActionState = {
  status: "idle",
};
