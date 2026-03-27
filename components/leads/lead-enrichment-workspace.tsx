"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  initialLeadEnrichmentActionState,
  initialLeadQueueMutationActionState,
} from "@/app/(workspace)/leads/enrichment/action-state";
import {
  removeLeadQueueCompaniesAction,
  runLeadEnrichmentAction,
} from "@/app/(workspace)/leads/enrichment/actions";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  LeadEnrichmentQueueRowView,
  LeadEnrichmentWorkspaceView,
} from "@/lib/data/selectors/lead-enrichment";

type CompareMode = "cards" | "compact";

function ResultTone({
  status,
}: Readonly<{
  status: "ready" | "needs_review" | "needs_enrichment" | "blocked" | "failed";
}>) {
  switch (status) {
    case "ready":
      return <StatusBadge label="Ready" tone="success" />;
    case "needs_review":
      return <StatusBadge label="Needs review" tone="accent" />;
    case "needs_enrichment":
      return <StatusBadge label="Needs enrichment" tone="warning" />;
    case "blocked":
      return <StatusBadge label="Still blocked" tone="danger" />;
    case "failed":
      return <StatusBadge label="Failed" tone="danger" />;
  }
}

function QueueListItem(props: Readonly<{
  row: LeadEnrichmentQueueRowView;
  checked: boolean;
  isActive: boolean;
  onToggle: (checked: boolean) => void;
  onFocus: () => void;
}>) {
  const { row } = props;

  return (
    <div
      className={`rounded-3xl border p-4 transition ${
        props.isActive
          ? "border-accent/35 bg-accent/10"
          : "border-white/8 bg-black/10 hover:border-white/12 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-medium text-copy">{row.companyName}</p>
            <StatusBadge label={row.readinessBadge.label} tone={row.readinessBadge.tone} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {row.market} • {row.subindustry}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
            {row.importedLabel} • {row.lastEnrichedLabel}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
          <input
            type="checkbox"
            checked={props.checked}
            onChange={(event) => props.onToggle(event.currentTarget.checked)}
            className="h-4 w-4 rounded border-white/15 bg-transparent"
          />
          Select
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          label={row.websiteDiscoveryBadge.label}
          tone={row.websiteDiscoveryBadge.tone}
        />
        <StatusBadge
          label={row.websiteDiscoveryConfidenceBadge.label}
          tone={row.websiteDiscoveryConfidenceBadge.tone}
        />
      </div>
      <p className="mt-3 text-sm text-copy">{row.recommendedOffer}</p>
      <p className="mt-2 text-sm text-muted">{row.contactCoverage}</p>
      <p className="mt-2 text-sm text-muted">{row.readinessReason}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onFocus}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            props.isActive
              ? "border-accent/50 bg-accent/15 text-copy"
              : "border-white/10 bg-white/[0.03] text-copy hover:border-white/14 hover:bg-white/[0.06]"
          }`}
        >
          {props.isActive ? "Focused" : "Open profile"}
        </button>
        <Link
          href={`/companies?companyId=${row.companyId}`}
          className="text-xs font-medium uppercase tracking-[0.18em] text-muted transition hover:text-copy"
        >
          Open company
        </Link>
      </div>
    </div>
  );
}

function MetaItem(props: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
      <p className="micro-label">{props.label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-copy">{props.value}</p>
    </div>
  );
}

function FocusedCompanyProfile({
  row,
}: Readonly<{
  row?: LeadEnrichmentQueueRowView;
}>) {
  if (!row) {
    return (
      <SectionCard
        title="Selected company"
        description="Choose a company from the enrichment queue to inspect its website, contact path, and readiness."
      >
        <EmptyState
          eyebrow="Company profile"
          title="Select a company to inspect it"
          description="The center pane expands one company into a fuller enrichment profile so you can verify the contact path before taking action."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={row.companyName}
      description={`${row.market} • ${row.subindustry}`}
      contentClassName="space-y-5"
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <div className="surface-muted p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={row.readinessBadge.label} tone={row.readinessBadge.tone} />
            <StatusBadge
              label={row.websiteDiscoveryBadge.label}
              tone={row.websiteDiscoveryBadge.tone}
            />
            <StatusBadge
              label={row.websiteDiscoveryConfidenceBadge.label}
              tone={row.websiteDiscoveryConfidenceBadge.tone}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Verified website</p>
            <p className="mt-2 break-words text-[0.95rem] font-medium leading-6 text-copy">
              {row.website ?? "No verified website on record"}
            </p>
            <p className="mt-2 break-words text-sm text-muted">
              {row.websiteDiscoveryCandidate}
            </p>
          </div>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            <MetaItem label="Discovery status" value={row.websiteDiscovery} />
            <MetaItem label="Page focus" value={row.preferredSupportingPageLabel} />
            <MetaItem label="Page source" value={row.preferredSupportingPageSource} />
          </div>
          <p className="mt-4 break-words text-sm leading-6 text-muted">
            {row.websiteDiscoverySource} • {row.websiteDiscoveryReason}
          </p>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Confidence overview</p>
          <div className="mt-3">
            <ConfidenceBreakdown
              items={[
                { label: "Website discovery", badge: row.websiteDiscoveryConfidenceBadge },
                { label: "Primary contact quality", badge: row.contactConfidenceBadge },
                { label: "Angle confidence", badge: row.angleConfidenceBadge },
                { label: "Readiness confidence", badge: row.readinessConfidenceBadge },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <div className="surface-muted p-5">
          <p className="micro-label">Contact coverage</p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Primary outreach path</p>
            <p className="mt-2 text-base font-medium text-copy">{row.decisionMaker}</p>
            <p className="mt-2 text-sm text-muted">
              Secondary: {row.secondaryContactLabel}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">{row.contactCoverage}</p>
          <p className="mt-2 text-sm text-muted">{row.namedCandidateSummary}</p>
          {row.relatedAccountSignals[0] ? (
            <p className="mt-2 text-sm text-warning">
              {row.relatedAccountSignals.join(" • ")}
            </p>
          ) : null}
          <div className="mt-4">
            <ContactRankingStack totalLabel={row.contactCountLabel} items={row.contactCandidates} />
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Angle and readiness</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={row.angleUrgencyBadge.label}
              tone={row.angleUrgencyBadge.tone}
            />
            <StatusBadge
              label={row.angleReviewPathBadge.label}
              tone={row.angleReviewPathBadge.tone}
            />
          </div>
          <p className="mt-3 text-base font-medium text-copy">{row.angleLabel}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{row.angleReason}</p>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            <MetaItem label="First offer" value={row.recommendedOffer} />
            <MetaItem label="Segment" value={row.segmentLabel} />
          </div>
          <p className="mt-3 text-sm text-muted">{row.noteHintSummary}</p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Readiness summary</p>
            <p className="mt-3 text-sm leading-6 text-copy">{row.readinessReason}</p>
            <p className="mt-2 text-sm text-muted">{row.enrichmentSummary}</p>
            <p className="mt-2 text-sm text-muted">{row.missingFieldsLabel}</p>
          </div>
        </div>
      </div>

      <div className="surface-muted p-5">
        <p className="micro-label">Provider transparency</p>
        <div className="mt-3">
          <ProviderRunSummary
            badge={row.providerBadge}
            label={row.providerLabel}
            fallback={row.providerFallbackLabel}
            evidence={row.providerEvidence}
            pageUsage={row.supportingPageUsage}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function CompareCompaniesPanel(props: Readonly<{
  rows: LeadEnrichmentQueueRowView[];
  mode: CompareMode;
}>) {
  const metrics = [
    {
      label: "Website",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        row.website ?? row.websiteDiscoveryCandidate,
    },
    {
      label: "Discovery",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        `${row.websiteDiscovery} • ${row.websiteDiscoveryReason}`,
    },
    {
      label: "Primary contact",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        `${row.primaryContactLabel} • ${row.primaryContactSelectionReason}`,
    },
    {
      label: "Named candidates",
      getValue: (row: LeadEnrichmentQueueRowView) => row.namedCandidateSummary,
    },
    {
      label: "Angle",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        `${row.angleLabel} • ${row.recommendedOffer}`,
    },
    {
      label: "Readiness",
      getValue: (row: LeadEnrichmentQueueRowView) => row.readinessReason,
    },
    {
      label: "Related accounts",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        row.relatedAccountSignals.join(" • ") ||
        "No shared-contact or host overlap detected",
    },
  ];

  if (props.mode === "compact") {
    return (
      <SectionCard
        title="Selected comparison"
        description="Compact compare keeps the same evidence in stacked metric blocks instead of a wide table."
      >
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="surface-muted p-4">
              <p className="micro-label">{metric.label}</p>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {props.rows.map((row) => (
                  <div key={`${row.companyId}-${metric.label}`} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <p className="text-sm font-medium text-copy">{row.companyName}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{metric.getValue(row)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Selected comparison"
      description="Explicit compare mode shows the selected companies side by side only when you ask for it."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {props.rows.map((row) => (
          <div key={row.companyId} className="surface-muted min-w-0 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-copy">{row.companyName}</p>
              <StatusBadge label={row.readinessBadge.label} tone={row.readinessBadge.tone} />
            </div>
            <p className="mt-2 text-sm text-muted">{row.market}</p>
            <p className="mt-3 break-words text-sm text-copy">
              {row.website ?? row.websiteDiscoveryCandidate}
            </p>
            <p className="mt-2 text-sm text-muted">{row.websiteDiscovery}</p>
            <p className="mt-3 text-sm text-copy">{row.primaryContactLabel}</p>
            <p className="mt-2 text-sm text-muted">{row.primaryContactSelectionReason}</p>
            <p className="mt-2 text-sm text-muted">Secondary: {row.secondaryContactLabel}</p>
            <p className="mt-3 text-sm text-muted">{row.namedCandidateSummary}</p>
            <p className="mt-3 text-sm text-copy">{row.angleLabel}</p>
            <p className="mt-2 text-sm text-muted">{row.readinessReason}</p>
            {row.relatedAccountSignals[0] ? (
              <p className="mt-3 text-sm text-warning">{row.relatedAccountSignals.join(" • ")}</p>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
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
  const [removalState, removalAction, isRemoving] = useActionState(
    removeLeadQueueCompaniesAction,
    initialLeadQueueMutationActionState,
  );
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [focusedCompanyId, setFocusedCompanyId] = useState<string>();
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      setCompareMode(null);
      setConfirmRemoval(false);
    }
  }, [state.status]);

  useEffect(() => {
    if (removalState.status === "success") {
      setSelectedCompanyIds([]);
      setFocusedCompanyId(undefined);
      setShowSelectedOnly(false);
      setCompareMode(null);
      setConfirmRemoval(false);
    }
  }, [removalState.status]);

  const selectedRows = useMemo(
    () => view.rows.filter((row) => selectedCompanyIds.includes(row.companyId)),
    [selectedCompanyIds, view.rows],
  );
  const queueRows =
    showSelectedOnly && selectedRows.length > 0 ? selectedRows : view.rows;
  const activeRow =
    queueRows.find((row) => row.companyId === focusedCompanyId) ??
    view.rows.find((row) => row.companyId === focusedCompanyId) ??
    queueRows[0] ??
    view.rows[0];
  const comparisonRows = selectedRows.length >= 2 ? selectedRows : [];
  const actionPanelRows = compareMode && comparisonRows.length >= 2
    ? view.campaignAssignment.rows.filter((row) =>
        comparisonRows.some((selected) => selected.companyId === row.companyId),
      )
    : activeRow
      ? view.campaignAssignment.rows.filter((row) => row.companyId === activeRow.companyId)
      : view.campaignAssignment.rows;
  const actionPanel = {
    ...view.campaignAssignment,
    rows: actionPanelRows,
  };

  useEffect(() => {
    if (focusedCompanyId && !view.rows.some((row) => row.companyId === focusedCompanyId)) {
      setFocusedCompanyId(undefined);
    }
  }, [focusedCompanyId, view.rows]);

  useEffect(() => {
    if (compareMode && comparisonRows.length < 2) {
      setCompareMode(null);
    }
  }, [compareMode, comparisonRows.length]);

  useEffect(() => {
    if (showSelectedOnly && selectedRows.length === 0) {
      setShowSelectedOnly(false);
    }
  }, [selectedRows.length, showSelectedOnly]);

  function toggleSelected(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) =>
      checked
        ? [...new Set([...current, companyId])]
        : current.filter((id) => id !== companyId),
    );
  }

  function focusCompany(companyId: string) {
    setFocusedCompanyId(companyId);
    setCompareMode(null);
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
                <p className="micro-label">Needs enrichment</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.stillNeedsEnrichmentCount}
                </p>
              </div>
              <div className="surface-muted p-4">
                <p className="micro-label">Still blocked</p>
                <p className="mt-2 text-2xl font-semibold text-copy">
                  {state.summary.blockedCount}
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
              {state.summary.results.slice(0, 6).map((result) => (
                <div key={result.companyId} className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-copy">{result.companyName}</p>
                      <p className="mt-1 text-sm text-muted">{result.message}</p>
                    </div>
                    <ResultTone status={result.status} />
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {result.primaryContactLabel ?? "No contact path yet"} • readiness confidence:{" "}
                    {result.confidenceLevel}
                  </p>
                  <p className="mt-2 text-sm text-copy">{result.readinessReason}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {removalState.message ? (
        <div
          className={`rounded-3xl border px-5 py-4 ${
            removalState.status === "success"
              ? "border-success/25 bg-success/10"
              : "border-warning/25 bg-warning/10"
          }`}
        >
          <p className="text-sm font-medium text-copy">{removalState.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1.55fr)_minmax(300px,360px)] 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1.7fr)_minmax(320px,380px)]">
        <SectionCard
          title="Enrichment queue"
          description={`Review ${showSelectedOnly && selectedRows.length > 0 ? `${selectedRows.length} selected companies` : `${view.rows.length} companies`} and choose one to inspect deeply.`}
          className="xl:min-h-[calc(100vh-20rem)]"
        >
          <div className="space-y-3 xl:max-h-[calc(100vh-26rem)] xl:overflow-y-auto xl:pr-1">
            {queueRows.map((row) => (
              <QueueListItem
                key={row.companyId}
                row={row}
                checked={selectedCompanyIds.includes(row.companyId)}
                isActive={row.companyId === activeRow?.companyId}
                onToggle={(checked) => toggleSelected(row.companyId, checked)}
                onFocus={() => focusCompany(row.companyId)}
              />
            ))}
          </div>
        </SectionCard>

        {compareMode && comparisonRows.length >= 2 ? (
          <CompareCompaniesPanel rows={comparisonRows} mode={compareMode} />
        ) : (
          <FocusedCompanyProfile row={activeRow} />
        )}

        <div className="space-y-4">
          <SectionCard
            title="Operator action rail"
            description="Run enrichment, focus the queue, compare selected companies, or remove bad-fit records without crowding the main profile."
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted">
                {compareMode && comparisonRows.length >= 2
                  ? `Compare mode is active for ${comparisonRows.length} selected companies.`
                  : activeRow
                    ? `Focused on ${activeRow.companyName}.`
                    : `Showing ${view.rows.length} companies in the queue.`}
                {showSelectedOnly && !compareMode ? " Hidden unrelated companies are temporarily removed from the queue list." : ""}
              </p>

              <form action={formAction} className="space-y-4">
                {selectedCompanyIds.map((companyId) => (
                  <input
                    key={`enrich-selected-${companyId}`}
                    type="hidden"
                    name="selectedCompanyIds"
                    value={companyId}
                  />
                ))}
                <div className="grid gap-3">
                  <button
                    type="submit"
                    name="scope"
                    value="selected"
                    disabled={isPending || selectedCompanyIds.length === 0}
                    className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Running..." : `Enrich selected (${selectedCompanyIds.length})`}
                  </button>
                  <button
                    type="submit"
                    name="scope"
                    value="queue"
                    disabled={isPending || view.rows.length === 0}
                    className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Enrich full queue
                  </button>
                  {activeRow ? (
                    <button
                      type="submit"
                      name="singleCompanyId"
                      value={activeRow.companyId}
                      disabled={isPending}
                      className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Enrich focused company
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="grid gap-3">
                <button
                  type="button"
                  disabled={selectedRows.length === 0}
                  onClick={() => {
                    setFocusedCompanyId(undefined);
                    setShowSelectedOnly(true);
                    setCompareMode(null);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Hide unrelated
                </button>
                <button
                  type="button"
                  disabled={selectedRows.length !== 1}
                  onClick={() => {
                    if (selectedRows[0]) {
                      focusCompany(selectedRows[0].companyId);
                      setShowSelectedOnly(true);
                    }
                  }}
                  className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Focus selected
                </button>
                <button
                  type="button"
                  disabled={comparisonRows.length < 2}
                  onClick={() => {
                    setFocusedCompanyId(undefined);
                    setShowSelectedOnly(true);
                    setCompareMode("cards");
                  }}
                  className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Compare selected
                </button>
                <button
                  type="button"
                  disabled={comparisonRows.length < 2}
                  onClick={() =>
                    setCompareMode((current) =>
                      current === "compact" ? "cards" : "compact",
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {compareMode === "compact" ? "Card compare" : "Compact compare"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFocusedCompanyId(undefined);
                    setShowSelectedOnly(false);
                    setCompareMode(null);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
                >
                  Show full queue
                </button>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Selection summary</p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {selectedCompanyIds.length === 0
                    ? "No companies selected yet."
                    : `${selectedCompanyIds.length} compan${selectedCompanyIds.length === 1 ? "y" : "ies"} selected for compare, enrichment, or removal.`}
                </p>
                {activeRow ? (
                  <p className="mt-2 text-sm text-copy">
                    Focused company: {activeRow.companyName}
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          {activeRow ? (
            <>
              <SectionCard
                title="Focused actions"
                description="Take website-review and contact-routing actions on the current company without collapsing the queue."
              >
                <div className="space-y-4">
                  <div className="surface-muted p-5">
                    <p className="micro-label">Website review</p>
                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                      <p className="micro-label">Current website</p>
                      <p className="mt-2 break-words text-[0.95rem] font-medium leading-6 text-copy">
                        {activeRow.website ?? activeRow.websiteDiscoveryCandidate}
                      </p>
                    </div>
                    <p className="mt-4 break-words text-sm text-muted">
                      {activeRow.websiteDiscoverySource} • {activeRow.websiteDiscoveryReason}
                    </p>
                    <div className="mt-4">
                      <WebsiteDiscoveryReviewActions
                        companyId={activeRow.companyId}
                        candidateWebsite={
                          activeRow.canReviewWebsiteCandidate
                            ? activeRow.candidateWebsite
                            : undefined
                        }
                        officialWebsite={activeRow.website}
                        compactLabel="Mark official"
                      />
                    </div>
                  </div>
                  <div className="surface-muted p-5">
                    <p className="micro-label">Primary contact</p>
                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                      <p className="micro-label">Chosen path</p>
                      <p className="mt-2 text-sm font-medium text-copy">
                        {activeRow.primaryContactLabel}
                      </p>
                    </div>
                    <p className="mt-4 text-sm text-muted">
                      {activeRow.primaryContactSelectionReason}
                    </p>
                    {activeRow.primaryContactWarnings[0] ? (
                      <p className="mt-2 text-sm text-warning">
                        {activeRow.primaryContactWarnings[0]}
                      </p>
                    ) : null}
                  </div>
                </div>
              </SectionCard>

              <CampaignEnrollmentPanel
                title={compareMode && comparisonRows.length >= 2
                  ? "Selected campaign assignment"
                  : "Focused campaign assignment"}
                description={compareMode && comparisonRows.length >= 2
                  ? "Assign or enroll the selected companies now that compare mode is explicit and separated from the main profile."
                  : "Assign or enroll the focused company from the right rail instead of squeezing campaign controls into the profile view."}
                panel={actionPanel}
                autoSelectSingle={actionPanel.rows.length === 1}
              />
            </>
          ) : null}

          <SectionCard
            title="Remove selected"
            description="Safely remove bad-fit records from the active queue without hard-deleting company history."
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted">
                Removal marks the selected companies as disqualified so they leave the active operator queue, while preserving website, contact, and campaign history for auditability.
              </p>

              {confirmRemoval ? (
                <div className="rounded-3xl border border-warning/25 bg-warning/10 p-4">
                  <p className="text-sm font-medium text-copy">
                    Confirm removal of {selectedCompanyIds.length} selected compan{selectedCompanyIds.length === 1 ? "y" : "ies"}?
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    This is a safe queue removal, not a permanent database delete.
                  </p>
                  <form action={removalAction} className="mt-4 flex flex-wrap gap-3">
                    {selectedCompanyIds.map((companyId) => (
                      <input
                        key={`remove-selected-${companyId}`}
                        type="hidden"
                        name="selectedCompanyIds"
                        value={companyId}
                      />
                    ))}
                    <input type="hidden" name="confirmation" value="remove_selected" />
                    <button
                      type="submit"
                      disabled={isRemoving || selectedCompanyIds.length === 0}
                      className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRemoving ? "Removing..." : "Confirm remove selected"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoval(false)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={selectedCompanyIds.length === 0}
                  onClick={() => setConfirmRemoval(true)}
                  className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove selected from queue
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
