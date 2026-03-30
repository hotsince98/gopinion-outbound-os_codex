import type {
  WorkspaceViewDefinition,
  WorkspaceViewScope,
} from "@/lib/domain";

const STORAGE_KEY = "gopinion:saved-workspace-views:v1";

interface SavedWorkspaceViewStorage {
  version: 1;
  views: WorkspaceViewDefinition[];
}

export function normalizeWorkspaceViewQuery(query: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => key !== "companyId" && value.trim().length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function areWorkspaceViewQueriesEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const normalizedLeft = normalizeWorkspaceViewQuery(left);
  const normalizedRight = normalizeWorkspaceViewQuery(right);
  const leftEntries = Object.entries(normalizedLeft);
  const rightEntries = Object.entries(normalizedRight);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value], index) => {
    const [rightKey, rightValue] = rightEntries[index] ?? [];

    return key === rightKey && value === rightValue;
  });
}

function isWorkspaceViewDefinition(
  value: unknown,
): value is WorkspaceViewDefinition {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkspaceViewDefinition).id === "string" &&
      typeof (value as WorkspaceViewDefinition).name === "string" &&
      typeof (value as WorkspaceViewDefinition).scope === "string" &&
      typeof (value as WorkspaceViewDefinition).path === "string" &&
      typeof (value as WorkspaceViewDefinition).createdAt === "string" &&
      typeof (value as WorkspaceViewDefinition).updatedAt === "string" &&
      typeof (value as WorkspaceViewDefinition).query === "object" &&
      value !== null,
  );
}

function readStorage(): SavedWorkspaceViewStorage {
  if (typeof window === "undefined") {
    return { version: 1, views: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { version: 1, views: [] };
    }

    const parsed = JSON.parse(raw) as Partial<SavedWorkspaceViewStorage>;
    const views = Array.isArray(parsed.views)
      ? parsed.views.filter(isWorkspaceViewDefinition)
      : [];

    return {
      version: 1,
      views,
    };
  } catch {
    return { version: 1, views: [] };
  }
}

function writeStorage(storage: SavedWorkspaceViewStorage) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function listSavedWorkspaceViews(scope: WorkspaceViewScope) {
  return readStorage().views.filter((view) => view.scope === scope);
}

export function upsertSavedWorkspaceView(
  draft: Omit<WorkspaceViewDefinition, "id" | "createdAt" | "updatedAt"> & {
    existingId?: WorkspaceViewDefinition["id"];
  },
) {
  const storage = readStorage();
  const now = new Date().toISOString();
  const id =
    draft.existingId ??
    (`workspace_view_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` as const);
  const existing = storage.views.find((view) => view.id === id);
  const nextView: WorkspaceViewDefinition = {
    id,
    scope: draft.scope,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    path: draft.path,
    query: normalizeWorkspaceViewQuery(draft.query),
    reviewLens: draft.reviewLens,
    uiState: draft.uiState,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextViews = existing
    ? storage.views.map((view) => (view.id === id ? nextView : view))
    : [...storage.views, nextView];

  writeStorage({
    version: 1,
    views: nextViews.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  });

  return nextView;
}

export function deleteSavedWorkspaceView(id: WorkspaceViewDefinition["id"]) {
  const storage = readStorage();

  writeStorage({
    version: 1,
    views: storage.views.filter((view) => view.id !== id),
  });
}
