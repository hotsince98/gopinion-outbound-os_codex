import type { IsoDateString } from "@/lib/domain/shared";

export const workspaceViewScopes = ["leads"] as const;
export type WorkspaceViewScope = (typeof workspaceViewScopes)[number];

export const workspaceViewReviewLensModels = [
  "recent_relevant_reviews",
] as const;
export type WorkspaceViewReviewLensModel =
  (typeof workspaceViewReviewLensModels)[number];

export interface WorkspaceViewUiState {
  selectedCompanyId?: string;
  focusedCompanyId?: string;
  compareMode?: "cards" | "compact";
  showSelectedOnly?: boolean;
}

export interface WorkspaceViewReviewLens {
  model: WorkspaceViewReviewLensModel;
  filters?: Record<string, string>;
}

export interface WorkspaceViewPreset {
  id: string;
  scope: WorkspaceViewScope;
  name: string;
  description: string;
  path: string;
  query: Record<string, string>;
  reviewLens: WorkspaceViewReviewLens;
}

export interface WorkspaceViewDefinition {
  id: `workspace_view_${string}`;
  scope: WorkspaceViewScope;
  name: string;
  description?: string;
  path: string;
  query: Record<string, string>;
  reviewLens: WorkspaceViewReviewLens;
  uiState?: WorkspaceViewUiState;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
