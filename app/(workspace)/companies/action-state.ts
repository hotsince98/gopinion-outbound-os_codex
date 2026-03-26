export interface PreferredSupportingPageActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialPreferredSupportingPageActionState: PreferredSupportingPageActionState =
  {
    status: "idle",
  };

export interface WebsiteDiscoveryReviewActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialWebsiteDiscoveryReviewActionState: WebsiteDiscoveryReviewActionState =
  {
    status: "idle",
  };
