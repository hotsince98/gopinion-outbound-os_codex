"use server";

import { revalidatePath } from "next/cache";
import { runLeadEnrichment } from "@/lib/data/enrichment/service";
import type { CompanyId, LeadEnrichmentRunScope } from "@/lib/domain";
import type { LeadEnrichmentActionState } from "@/app/(workspace)/leads/enrichment/action-state";

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
