"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { runLeadEnrichmentAction } from "@/app/(workspace)/leads/enrichment/actions";
import { initialLeadEnrichmentActionState } from "@/app/(workspace)/leads/enrichment/action-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  LeadEnrichmentWorkspaceView,
} from "@/lib/data/selectors/lead-enrichment";

function ResultTone({
  status,
}: Readonly<{
  status: "ready" | "needs_review" | "needs_enrichment" | "failed";
}>) {
  switch (status) {
    case "ready":
      return <StatusBadge label="Ready" tone="success" />;
    case "needs_review":
      return <StatusBadge label="Needs review" tone="accent" />;
    case "needs_enrichment":
      return <StatusBadge label="Needs enrichment" tone="warning" />;
    case "failed":
      return <StatusBadge label="Failed" tone="danger" />;
  }
}

export function LeadEnrichmentWorkspace({
  view,
}: Readonly<{
  view: LeadEnrichmentWorkspaceView;
}>) {
  const [state, formAction, isPending] = useActionState(
    runLeadEnrichmentAction,
    initialLeadEnrichmentActionState,
  );
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    if (state.status === "success") {
      setSelectedCompanyIds([]);
    }
  }, [state.status]);

  const allSelected =
    view.rows.length > 0 && selectedCompanyIds.length === view.rows.length;

  function toggleSelected(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) =>
      checked
        ? [...new Set([...current, companyId])]
        : current.filter((id) => id !== companyId),
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedCompanyIds(checked ? view.rows.map((row) => row.companyId) : []);
  }

  if (view.rows.length === 0) {
    return (
      <div className="surface-muted p-5">
        <p className="micro-label">Queue</p>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-copy">
          {view.emptyState.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">
          {view.emptyState.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/leads"
            className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
          >
            Back to leads
          </Link>
          <Link
            href="/leads/intake"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
          >
            Import more leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="surface-muted p-4">
                <p className="micro-label">Ready</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.readyCount}
                </p>
              </div>
              <div className="surface-muted p-4">
                <p className="micro-label">Needs review</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.needsReviewCount}
                </p>
              </div>
              <div className="surface-muted p-4">
                <p className="micro-label">Still blocked</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.stillNeedsEnrichmentCount}
                </p>
              </div>
              <div className="surface-muted p-4">
                <p className="micro-label">Failed</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.failedCount}
                </p>
              </div>
            </div>
          ) : null}
          {state.summary?.results.length ? (
            <div className="mt-4 space-y-3">
              {state.summary.results.slice(0, 10).map((result) => (
                <div key={result.companyId} className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-copy">
                        {result.companyName}
                      </p>
                      <p className="mt-1 text-sm text-muted">{result.message}</p>
                    </div>
                    <ResultTone status={result.status} />
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {result.primaryContactLabel ?? "No contact path yet"} •{" "}
                    {result.confidenceLevel} confidence
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Missing: {result.missingFields.join(", ") || "nothing critical"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="micro-label">Bulk enrichment</p>
              <p className="text-sm leading-6 text-muted">
                Scan company websites for emails, phones, contact clues, and
                category signals. A role inbox can still move a lead toward
                campaign readiness, even before a named person is verified.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                name="scope"
                value="selected"
                disabled={isPending || selectedCompanyIds.length === 0}
                className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Running..." : `Enrich selected (${selectedCompanyIds.length})`}
              </button>
              <button
                type="submit"
                name="scope"
                value="queue"
                disabled={isPending || view.rows.length === 0}
                className="rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enrich full queue
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/8">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.currentTarget.checked)}
                      className="h-4 w-4 rounded border-white/15 bg-transparent"
                    />
                  </th>
                  {[
                    "Company",
                    "Website",
                    "Confidence",
                    "Missing",
                    "Coverage",
                    "Action",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {view.rows.map((row) => (
                  <tr key={row.companyId} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4 align-top">
                      <input
                        type="checkbox"
                        name="selectedCompanyIds"
                        value={row.companyId}
                        checked={selectedCompanyIds.includes(row.companyId)}
                        onChange={(event) =>
                          toggleSelected(row.companyId, event.currentTarget.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-white/15 bg-transparent"
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/companies?companyId=${row.companyId}`}
                            className="font-medium text-copy transition hover:text-accent"
                          >
                            {row.companyName}
                          </Link>
                        </div>
                        <p className="text-sm text-muted">
                          {row.market} • {row.subindustry}
                        </p>
                        <p className="text-sm text-muted">{row.lastEnrichedLabel}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="text-sm text-copy">
                          {row.website ?? "No website on record"}
                        </p>
                        <p className="text-sm text-muted">{row.enrichmentSummary}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={row.confidenceBadge.label}
                        tone={row.confidenceBadge.tone}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-sm leading-6 text-muted">
                        {row.missingFieldsLabel}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="text-sm text-copy">{row.decisionMaker}</p>
                        <p className="text-sm text-muted">{row.contactCoverage}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="submit"
                        name="singleCompanyId"
                        value={row.companyId}
                        disabled={isPending}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Enrich now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    </div>
  );
}
