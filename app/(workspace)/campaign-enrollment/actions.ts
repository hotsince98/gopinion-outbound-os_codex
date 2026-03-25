"use server";

import { revalidatePath } from "next/cache";
import type { CampaignEnrollmentMode, CampaignId, CompanyId } from "@/lib/domain";
import { runCampaignEnrollment } from "@/lib/data/campaigns/assignment";
import type { CampaignEnrollmentActionState } from "@/app/(workspace)/campaign-enrollment/action-state";

function revalidateCampaignEnrollmentSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/leads/enrichment");
  revalidatePath("/companies");
  revalidatePath("/campaigns");
  revalidatePath("/appointments");
  revalidatePath("/graph");
}

export async function runCampaignEnrollmentAction(
  _previousState: CampaignEnrollmentActionState,
  formData: FormData,
): Promise<CampaignEnrollmentActionState> {
  try {
    const singleCompanyId = formData.get("singleCompanyId")?.toString();
    const selectedCompanyIds = formData
      .getAll("selectedCompanyIds")
      .map((value) => value.toString())
      .filter(Boolean) as CompanyId[];
    const mode = (formData.get("mode")?.toString() ?? "assign") as CampaignEnrollmentMode;
    const campaignIdValue = formData.get("campaignId")?.toString().trim();
    const campaignId = campaignIdValue
      ? (campaignIdValue as CampaignId)
      : undefined;
    const companyIds = singleCompanyId
      ? [singleCompanyId as CompanyId]
      : selectedCompanyIds;

    if (companyIds.length === 0) {
      return {
        status: "error",
        message: "Select at least one lead before assigning or enrolling it.",
      };
    }

    const summary = await runCampaignEnrollment({
      companyIds,
      mode,
      campaignId,
    });

    revalidateCampaignEnrollmentSurfaces();

    return {
      status: "success",
      message:
        mode === "enroll"
          ? `Processed ${summary.requestedCount} lead${
              summary.requestedCount === 1 ? "" : "s"
            }: ${summary.enrolledCount} enrolled, ${summary.reviewCount} moved to review, ${summary.blockedCount} blocked.`
          : `Processed ${summary.requestedCount} lead${
              summary.requestedCount === 1 ? "" : "s"
            }: ${summary.assignedCount} assigned, ${summary.reviewCount} queued for review, ${summary.blockedCount} blocked.`,
      summary,
    };
  } catch {
    return {
      status: "error",
      message:
        "Campaign assignment failed before the workspace could be updated. Try again in a moment.",
    };
  }
}
