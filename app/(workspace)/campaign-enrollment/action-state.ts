import type { CampaignEnrollmentRunSummary } from "@/lib/domain";

export interface CampaignEnrollmentActionState {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: CampaignEnrollmentRunSummary;
}

export const initialCampaignEnrollmentActionState: CampaignEnrollmentActionState =
  {
    status: "idle",
  };
