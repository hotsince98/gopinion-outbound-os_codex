export interface PreferredSupportingPageActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialPreferredSupportingPageActionState: PreferredSupportingPageActionState =
  {
    status: "idle",
  };
