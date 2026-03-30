"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  WorkspaceViewDefinition,
  WorkspaceViewPreset,
} from "@/lib/domain";
import {
  areWorkspaceViewQueriesEqual,
  deleteSavedWorkspaceView,
  listSavedWorkspaceViews,
  normalizeWorkspaceViewQuery,
  upsertSavedWorkspaceView,
} from "@/lib/data/workspace-views/browser";
import { cn } from "@/lib/utils";

function buildQueryPath(path: string, query: Record<string, string>) {
  const params = new URLSearchParams(normalizeWorkspaceViewQuery(query));
  const search = params.toString();

  return search ? `${path}?${search}` : path;
}

function ViewChip(props: Readonly<{
  name: string;
  description?: string;
  href: string;
  active: boolean;
  trailingAction?: ReactNode;
}>) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-full border px-3 py-2 transition",
        props.active
          ? "border-accent/35 bg-accent/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.06]",
      )}
      title={props.description}
    >
      <Link
        href={props.href}
        className="min-w-0 text-sm font-medium text-copy"
      >
        <span className="truncate">{props.name}</span>
      </Link>
      {props.trailingAction ? <div className="shrink-0">{props.trailingAction}</div> : null}
    </div>
  );
}

export function SavedWorkspaceViewsBar(props: Readonly<{
  path: string;
  currentQuery: Record<string, string>;
  presets: WorkspaceViewPreset[];
}>) {
  const [savedViews, setSavedViews] = useState<WorkspaceViewDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewDescription, setViewDescription] = useState("");
  const currentQuery = useMemo(
    () => normalizeWorkspaceViewQuery(props.currentQuery),
    [props.currentQuery],
  );

  useEffect(() => {
    setSavedViews(listSavedWorkspaceViews("leads"));
  }, []);

  const activePresetId = props.presets.find((preset) =>
    areWorkspaceViewQueriesEqual(preset.query, currentQuery),
  )?.id;
  const activeSavedViewId = savedViews.find((view) =>
    areWorkspaceViewQueriesEqual(view.query, currentQuery),
  )?.id;

  function refreshSavedViews() {
    setSavedViews(listSavedWorkspaceViews("leads"));
  }

  function handleSaveCurrentView() {
    const trimmedName = viewName.trim();

    if (!trimmedName) {
      return;
    }

    const existing = savedViews.find(
      (view) => view.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    upsertSavedWorkspaceView({
      existingId: existing?.id,
      scope: "leads",
      name: trimmedName,
      description: viewDescription.trim() || undefined,
      path: props.path,
      query: currentQuery,
      reviewLens: {
        model: "recent_relevant_reviews",
        filters: currentQuery.review ? { signal: currentQuery.review } : undefined,
      },
    });
    refreshSavedViews();
    setIsSaving(false);
    setViewName("");
    setViewDescription("");
  }

  function handleDeleteView(id: WorkspaceViewDefinition["id"]) {
    deleteSavedWorkspaceView(id);
    refreshSavedViews();
  }

  return (
    <div className="surface-panel px-5 py-5 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="micro-label">Saved views</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Return to the queue states you use most often without rebuilding filters. Saved views already use a review-lens model that can grow from one latest review to richer recent-review sets later.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSaving((current) => !current)}
          className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
        >
          {isSaving ? "Close save panel" : "Save current view"}
        </button>
      </div>

      {isSaving ? (
        <div className="mt-4 grid gap-3 rounded-[1.4rem] border border-white/10 bg-black/10 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_auto]">
          <label className="space-y-2">
            <span className="micro-label">View name</span>
            <input
              type="text"
              value={viewName}
              onChange={(event) => setViewName(event.currentTarget.value)}
              placeholder="Fresh review follow-up"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
            />
          </label>
          <label className="space-y-2">
            <span className="micro-label">Description</span>
            <input
              type="text"
              value={viewDescription}
              onChange={(event) => setViewDescription(event.currentTarget.value)}
              placeholder="Fresh unanswered low-star reviews in active territories"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSaveCurrentView}
              disabled={!viewName.trim()}
              className="w-full rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save view
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <p className="micro-label">Built-in workflow views</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.presets.map((preset) => (
              <ViewChip
                key={preset.id}
                name={preset.name}
                description={preset.description}
                href={buildQueryPath(props.path, preset.query)}
                active={activePresetId === preset.id}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="micro-label">My saved views</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {savedViews.length > 0 ? (
              savedViews.map((view) => (
                <ViewChip
                  key={view.id}
                  name={view.name}
                  description={view.description}
                  href={buildQueryPath(view.path, view.query)}
                  active={activeSavedViewId === view.id}
                  trailingAction={
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleDeleteView(view.id);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-copy"
                    >
                      Remove
                    </button>
                  }
                />
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-white/10 px-4 py-3 text-sm text-muted">
                No custom views saved yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
