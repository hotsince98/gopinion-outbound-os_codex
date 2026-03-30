"use client";

import { useActionState, useEffect, useState } from "react";
import { runCampaignEnrollmentAction } from "@/app/(workspace)/campaign-enrollment/actions";
import { initialCampaignEnrollmentActionState } from "@/app/(workspace)/campaign-enrollment/action-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CampaignAssignmentPanelView } from "@/lib/data/selectors/campaign-assignment";

function ResultTone({
  status,
}: Readonly<{
  status: "assigned" | "enrolled" | "review" | "blocked" | "failed";
}>) {
  switch (status) {
    case "assigned":
      return <StatusBadge label="Assigned" tone="accent" />;
    case "enrolled":
      return <StatusBadge label="Enrolled" tone="success" />;
    case "review":
      return <StatusBadge label="Needs review" tone="warning" />;
    case "blocked":
      return <StatusBadge label="Blocked" tone="danger" />;
    case "failed":
      return <StatusBadge label="Failed" tone="danger" />;
  }
}

export function CampaignEnrollmentPanel({
  title,
  description,
  panel,
  autoSelectSingle = false,
}: Readonly<{
  title: string;
  description: string;
  panel: CampaignAssignmentPanelView;
  autoSelectSingle?: boolean;
}>) {
  const [state, formAction, isPending] = useActionState(
    runCampaignEnrollmentAction,
    initialCampaignEnrollmentActionState,
  );
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
    autoSelectSingle && panel.rows.length === 1 ? [panel.rows[0].companyId] : [],
  );

  useEffect(() => {
    if (autoSelectSingle && panel.rows.length === 1) {
      setSelectedCompanyIds([panel.rows[0].companyId]);
    }
  }, [autoSelectSingle, panel.rows]);

  useEffect(() => {
    if (state.status === "success") {
      setSelectedCompanyIds(
        autoSelectSingle && panel.rows.length === 1 ? [panel.rows[0].companyId] : [],
      );
    }
  }, [autoSelectSingle, panel.rows, state.status]);

  const allSelected =
    panel.rows.length > 0 && selectedCompanyIds.length === panel.rows.length;
  const readyCount = panel.rows.filter((row) => row.canEnroll).length;
  const blockedCount = panel.rows.filter((row) => !row.canAssign).length;
  const reviewCount = panel.rows.filter(
    (row) => row.canAssign && !row.canEnroll,
  ).length;

  function toggleSelected(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) =>
      checked
        ? [...new Set([...current, companyId])]
        : current.filter((id) => id !== companyId),
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedCompanyIds(checked ? panel.rows.map((row) => row.companyId) : []);
  }

  if (panel.rows.length === 0) {
    return (
      <div className="surface-muted p-5">
        <p className="micro-label">Campaign enrollment</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          No visible leads are available for assignment in this view right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.message ? (
        <div
          className={`rounded-3xl border px-5 py-5 ${
            state.status === "success"
              ? "border-success/25 bg-success/10"
              : "border-warning/25 bg-warning/10"
          }`}
        >
          <p className="text-sm font-medium text-copy">{state.message}</p>
          {state.summary ? (
            <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))]">
              <div className="surface-muted p-5">
                <p className="micro-label">Assigned</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.assignedCount}
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="micro-label">Enrolled</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.enrolledCount}
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="micro-label">Needs review</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.reviewCount}
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="micro-label">Blocked</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.blockedCount}
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="micro-label">Failed</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.failedCount}
                </p>
              </div>
            </div>
          ) : null}
          {state.summary?.results.length ? (
            <div className="mt-4 space-y-3">
              {state.summary.results.slice(0, 8).map((result) => (
                <div key={result.companyId} className="surface-muted p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-copy">
                        {result.companyName}
                      </p>
                      <p className="mt-1 text-sm text-muted">{result.message}</p>
                    </div>
                    <ResultTone status={result.status} />
                  </div>
                  {result.campaignName ? (
                    <p className="mt-2 text-sm text-copy">
                      Campaign: {result.campaignName}
                    </p>
                  ) : null}
                  {result.primaryContactLabel ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.primaryContactLabel}
                      {result.primaryContactQuality
                        ? ` • ${result.primaryContactQuality}`
                        : ""}
                    </p>
                  ) : null}
                  {result.primaryContactSource ? (
                    <p className="mt-2 text-sm text-muted">
                      Source: {result.primaryContactSource}
                    </p>
                  ) : null}
                  {result.warnings[0] ? (
                    <p className="mt-2 text-sm text-warning">
                      Warning: {result.warnings[0]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="surface-panel overflow-hidden p-5 lg:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="micro-label">{title}</p>
              <p className="text-sm leading-6 text-muted">{description}</p>
              <p className="text-sm text-muted">
                {readyCount} ready to enroll now • {reviewCount} need review •{" "}
                {blockedCount} blocked
              </p>
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="micro-label">Target campaign</span>
                <select
                  name="campaignId"
                  defaultValue=""
                  className="field-shell"
                >
                  <option value="">Use recommended campaign</option>
                  {panel.campaignOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} • {option.detail}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
                <button
                  type="submit"
                  name="mode"
                  value="assign"
                  disabled={isPending || selectedCompanyIds.length === 0}
                  className="rounded-[1.15rem] border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Working..." : `Assign selected (${selectedCompanyIds.length})`}
                </button>

                <button
                  type="submit"
                  name="mode"
                  value="enroll"
                  disabled={isPending || selectedCompanyIds.length === 0}
                  className="rounded-[1.15rem] border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Working..." : `Enroll selected (${selectedCompanyIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-panel p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => toggleAll(event.currentTarget.checked)}
                className="h-4 w-4 rounded border-white/15 bg-transparent"
              />
              Select all visible
            </label>
            <p className="text-sm text-muted">
              {selectedCompanyIds.length} selected • {panel.rows.length} in view
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {panel.rows.map((row) => (
              <label
                key={row.companyId}
                className={`block rounded-[1.6rem] border p-4 transition ${
                  selectedCompanyIds.includes(row.companyId)
                    ? "surface-elevated border-accent/30"
                    : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] hover:border-white/12 hover:bg-white/[0.04]"
                }`}
              >
                <input
                  type="checkbox"
                  name="selectedCompanyIds"
                  value={row.companyId}
                  checked={selectedCompanyIds.includes(row.companyId)}
                  onChange={(event) =>
                    toggleSelected(row.companyId, event.currentTarget.checked)
                  }
                  className="sr-only"
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-copy">{row.companyName}</span>
                      <StatusBadge
                        label={row.readinessBadge.label}
                        tone={row.readinessBadge.tone}
                      />
                      <StatusBadge
                        label={row.confidenceBadge.label}
                        tone={row.confidenceBadge.tone}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted">{row.market}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                      {row.lastEnrichedLabel}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                    {selectedCompanyIds.includes(row.companyId) ? "Selected" : "Select"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
                  <div className="surface-soft p-4">
                    <p className="micro-label">Campaign recommendation</p>
                    <p className="mt-3 text-sm font-medium text-copy">
                      {row.recommendedCampaignName}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      First offer: {row.recommendedOffer}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge
                        label={row.recommendedCampaignStatusBadge.label}
                        tone={row.recommendedCampaignStatusBadge.tone}
                      />
                      {row.manualReviewRequired ? (
                        <StatusBadge label="Manual review" tone="warning" />
                      ) : null}
                      {row.campaignReviewRequired ? (
                        <StatusBadge label="Campaign review" tone="accent" />
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-copy">{row.angleLabel}</p>
                    <p className="mt-2 text-sm text-muted">{row.angleReason}</p>
                    <p className="mt-2 text-sm text-muted">{row.currentCampaignLabel}</p>
                  </div>

                  <div className="surface-soft p-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        label={row.decisionBadge.label}
                        tone={row.decisionBadge.tone}
                      />
                      {!row.canAssign ? (
                        <StatusBadge label="Cannot assign" tone="danger" />
                      ) : row.canEnroll ? (
                        <StatusBadge label="Can enroll" tone="success" />
                      ) : (
                        <StatusBadge label="Review before enrollment" tone="accent" />
                      )}
                    </div>
                    <p className="mt-3 text-sm text-copy">{row.primaryContactLabel}</p>
                    <p className="mt-2 text-sm text-muted">{row.primaryContactQuality}</p>
                    <p className="mt-2 text-sm text-muted">{row.primaryContactSource}</p>
                    {row.primaryContactWarnings[0] ? (
                      <p className="mt-2 text-sm text-warning">
                        {row.primaryContactWarnings[0]}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-6 text-copy">{row.decisionReason}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
