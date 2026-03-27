"use server";

import { revalidatePath } from "next/cache";
import { getDataAccess } from "@/lib/data/access";
import { runLeadEnrichment } from "@/lib/data/enrichment/service";
import type { CompanyId, LeadEnrichmentRunScope } from "@/lib/domain";
import type {
  LeadEnrichmentActionState,
  LeadQueueMutationActionState,
} from "@/app/(workspace)/leads/enrichment/action-state";

function revalidateLeadSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/leads/enrichment");
  revalidatePath("/companies");
  revalidatePath("/graph");
}

export async function runLeadEnrichmentAction(
  _previousState: LeadEnrichmentActionState,
  formData: FormData,
): Promise<LeadEnrichmentActionState> {
  try {
    const singleCompanyId = formData.get("singleCompanyId")?.toString();
    const selectedCompanyIds = formData
      .getAll("selectedCompanyIds")
      .map((value) => value.toString())
      .filter(Boolean) as CompanyId[];
    const scope = (formData.get("scope")?.toString() ?? "selected") as LeadEnrichmentRunScope;

    const resolvedScope: LeadEnrichmentRunScope = singleCompanyId
      ? "single"
      : scope === "queue"
        ? "queue"
        : "selected";

    if (resolvedScope === "selected" && selectedCompanyIds.length === 0) {
      return {
        status: "error",
        message: "Select at least one company before running bulk enrichment.",
      };
    }

    const summary = await runLeadEnrichment({
      scope: resolvedScope,
      companyIds: singleCompanyId
        ? [singleCompanyId as CompanyId]
        : selectedCompanyIds,
    });

    revalidateLeadSurfaces();

    return {
      status: "success",
      message:
        summary.failedCount === 0
          ? `Processed ${summary.processedCount} enrichment run${
              summary.processedCount === 1 ? "" : "s"
            }.`
          : `Processed ${summary.processedCount} enrichment run${
              summary.processedCount === 1 ? "" : "s"
            } with ${summary.failedCount} failure${
              summary.failedCount === 1 ? "" : "s"
            }.`,
      summary,
    };
  } catch {
    return {
      status: "error",
      message:
        "Bulk enrichment failed before the queue could be updated. Try again in a moment.",
    };
  }
}

export async function removeLeadQueueCompaniesAction(
  _previousState: LeadQueueMutationActionState,
  formData: FormData,
): Promise<LeadQueueMutationActionState> {
  try {
    const selectedCompanyIds = formData
      .getAll("selectedCompanyIds")
      .map((value) => value.toString())
      .filter(Boolean) as CompanyId[];
    const confirmation = formData.get("confirmation")?.toString();

    if (selectedCompanyIds.length === 0) {
      return {
        status: "error",
        message: "Select at least one company before removing it from the active queue.",
      };
    }

    if (confirmation !== "remove_selected") {
      return {
        status: "error",
        message: "Confirm the removal step before updating the queue.",
      };
    }

    const dataAccess = getDataAccess();
    const now = new Date().toISOString();
    let removedCount = 0;

    for (const companyId of Array.from(new Set(selectedCompanyIds))) {
      const company = await dataAccess.companies.getById(companyId);

      if (!company || company.status === "disqualified") {
        continue;
      }

      const nextNotes = [
        ...(company.notes ?? []),
        `Operator removed this company from the active queue on ${now}.`,
      ];

      await dataAccess.companies.update({
        ...company,
        status: "disqualified",
        notes: Array.from(new Set(nextNotes)),
        updatedAt: now,
      });
      removedCount += 1;
    }

    revalidateLeadSurfaces();

    return {
      status: "success",
      message:
        removedCount === 0
          ? "The selected companies were already out of the active queue."
          : `Removed ${removedCount} compan${removedCount === 1 ? "y" : "ies"} from the active queue. History was preserved on the company records.`,
      removedCount,
    };
  } catch {
    return {
      status: "error",
      message: "The queue removal step failed before the selected companies could be updated.",
    };
  }
}
