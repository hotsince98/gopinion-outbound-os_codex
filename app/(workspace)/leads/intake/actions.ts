"use server";

import { revalidatePath } from "next/cache";
import type {
  LeadImportSummary,
  LeadIntakeFieldErrors,
} from "@/lib/domain";
import { parseLeadCsvText } from "@/lib/data/intake/csv";
import { importLeadRows, createLeadFromInput } from "@/lib/data/intake/service";
import { normalizeLeadIntakeInput } from "@/lib/data/intake/validation";

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

function revalidateLeadSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/companies");
  revalidatePath("/graph");
}

export async function createManualLeadAction(
  _previousState: ManualLeadActionState,
  formData: FormData,
): Promise<ManualLeadActionState> {
  const input = normalizeLeadIntakeInput(
    {
      companyName: formData.get("companyName")?.toString(),
      website: formData.get("website")?.toString(),
      subindustry: formData.get("subindustry")?.toString(),
      city: formData.get("city")?.toString(),
      state: formData.get("state")?.toString(),
      country: formData.get("country")?.toString(),
      googleRating: formData.get("googleRating")?.toString(),
      reviewCount: formData.get("reviewCount")?.toString(),
      primaryContactName: formData.get("primaryContactName")?.toString(),
      contactTitle: formData.get("contactTitle")?.toString(),
      contactEmail: formData.get("contactEmail")?.toString(),
      notes: formData.get("notes")?.toString(),
    },
    "manual",
  );

  const outcome = await createLeadFromInput(input);

  if (outcome.status === "success" && outcome.result) {
    revalidateLeadSurfaces();

    return {
      status: "success",
      message: outcome.message,
      createdCompanyId: outcome.result.company.id,
      createdCompanyName: outcome.result.company.name,
    };
  }

  return {
    status: "error",
    message: outcome.message,
    fieldErrors: outcome.fieldErrors,
    duplicateMessages: outcome.duplicateCheck
      ? [
          outcome.duplicateCheck.companyNameMatch
            ? `Company name matches ${outcome.duplicateCheck.companyNameMatch.name}.`
            : "",
          outcome.duplicateCheck.websiteMatch
            ? `Website matches ${outcome.duplicateCheck.websiteMatch.name}.`
            : "",
        ].filter(Boolean)
      : undefined,
  };
}

export async function importLeadCsvAction(
  _previousState: CsvLeadImportActionState,
  formData: FormData,
): Promise<CsvLeadImportActionState> {
  const csvText = formData.get("csvText")?.toString().trim() ?? "";

  if (!csvText) {
    return {
      status: "error",
      message: "Upload a CSV before trying to import.",
    };
  }

  const parsed = parseLeadCsvText(csvText);
  if (parsed.rows.length === 0) {
    return {
      status: "error",
      message: "No lead rows were detected in the uploaded CSV.",
    };
  }

  const summary = await importLeadRows(parsed.rows);

  if (summary.createdCompanies > 0) {
    revalidateLeadSurfaces();

    return {
      status: "success",
      message:
        summary.createdCompanies === 1
          ? "Imported 1 lead into the intake queue."
          : `Imported ${summary.createdCompanies} leads into the intake queue.`,
      summary,
    };
  }

  return {
    status: "error",
    message:
      "No leads were imported. Review the preview and duplicate notices, then try again.",
    summary,
  };
}
