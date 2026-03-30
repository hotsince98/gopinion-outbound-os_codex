"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  initialLeadEnrichmentActionState,
  initialLeadQueueMutationActionState,
} from "@/app/(workspace)/leads/enrichment/action-state";
import {
  deleteLeadQueueCompaniesAction,
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
type ReviewFilter = "all" | "urgent" | "fresh" | "with_context" | "missing";
type WebsiteFilter = "all" | "verified" | "candidate" | "missing";
type ContactPathFilter = "all" | "named" | "fallback" | "missing";

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
        <StatusBadge
          label={row.latestReviewBadge.label}
          tone={row.latestReviewBadge.tone}
        />
      </div>
      <p className="mt-3 text-sm text-copy">{row.recommendedOffer}</p>
      <p className="mt-2 text-sm text-muted">{row.latestReviewSummary}</p>
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="micro-label">Latest public review</p>
            <StatusBadge
              label={row.latestReviewBadge.label}
              tone={row.latestReviewBadge.tone}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-copy">{row.latestReviewSummary}</p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Review metadata</p>
            <p className="mt-2 text-sm leading-6 text-copy">{row.latestReviewMetaLabel}</p>
            {row.latestReviewSnippet ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                {row.latestReviewSnippet}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                No recent review snippet was imported yet.
              </p>
            )}
          </div>
        </div>
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
      label: "Latest review",
      getValue: (row: LeadEnrichmentQueueRowView) =>
        `${row.latestReviewSummary} • ${row.latestReviewMetaLabel}`,
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
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteLeadQueueCompaniesAction,
    initialLeadQueueMutationActionState,
  );
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [focusedCompanyId, setFocusedCompanyId] = useState<string>();
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode | null>(null);
  const [queueSearch, setQueueSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [contactPathFilter, setContactPathFilter] = useState<ContactPathFilter>("all");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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

  useEffect(() => {
    if (deleteState.status === "success") {
      setSelectedCompanyIds([]);
      setFocusedCompanyId(undefined);
      setShowSelectedOnly(false);
      setCompareMode(null);
      setConfirmRemoval(false);
      setDeleteConfirmation("");
    }
  }, [deleteState.status]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = queueSearch.trim().toLowerCase();

    return view.rows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          row.companyName,
          row.market,
          row.subindustry,
          row.recommendedOffer,
          row.website ?? row.websiteDiscoveryCandidate,
          row.primaryContactLabel,
          row.latestReviewSummary,
          row.latestReviewSnippet,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch));

      const matchesReview =
        reviewFilter === "all" ||
        (reviewFilter === "with_context"
          ? row.latestReviewFilterState !== "missing"
          : row.latestReviewFilterState === reviewFilter);

      const websiteState: WebsiteFilter = row.website
        ? "verified"
        : row.candidateWebsite
          ? "candidate"
          : "missing";
      const matchesWebsite = websiteFilter === "all" || websiteState === websiteFilter;

      const contactState: ContactPathFilter =
        row.contactCandidates.length === 0
          ? "missing"
          : row.contactCandidates[0]?.isNamedPerson
            ? "named"
            : "fallback";
      const matchesContact =
        contactPathFilter === "all" || contactState === contactPathFilter;

      return matchesSearch && matchesReview && matchesWebsite && matchesContact;
    });
  }, [contactPathFilter, queueSearch, reviewFilter, view.rows, websiteFilter]);

  const selectedRows = useMemo(
    () => view.rows.filter((row) => selectedCompanyIds.includes(row.companyId)),
    [selectedCompanyIds, view.rows],
  );
  const visibleSelectedRows = useMemo(
    () => filteredRows.filter((row) => selectedCompanyIds.includes(row.companyId)),
    [filteredRows, selectedCompanyIds],
  );
  const queueRows =
    showSelectedOnly && visibleSelectedRows.length > 0 ? visibleSelectedRows : filteredRows;
  const activeRow =
    queueRows.find((row) => row.companyId === focusedCompanyId) ??
    filteredRows.find((row) => row.companyId === focusedCompanyId) ??
    queueRows[0] ??
    filteredRows[0];
  const comparisonRows = selectedRows.length >= 2 ? selectedRows : [];
  const actionPanelRows = compareMode && comparisonRows.length >= 2
    ? view.campaignAssignment.rows.filter((row) =>
        comparisonRows.some((selected) => selected.companyId === row.companyId),
      )
    : activeRow
      ? view.campaignAssignment.rows.filter((row) => row.companyId === activeRow.companyId)
      : [];
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
    if (showSelectedOnly && visibleSelectedRows.length === 0) {
      setShowSelectedOnly(false);
    }
  }, [showSelectedOnly, visibleSelectedRows.length]);

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

  function selectVisibleRows() {
    setSelectedCompanyIds((current) =>
      Array.from(new Set([...current, ...queueRows.map((row) => row.companyId)])),
    );
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

      {deleteState.message ? (
        <div
          className={`rounded-3xl border px-5 py-4 ${
            deleteState.status === "success"
              ? "border-success/25 bg-success/10"
              : "border-warning/25 bg-warning/10"
          }`}
        >
          <p className="text-sm font-medium text-copy">{deleteState.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1.55fr)_minmax(300px,360px)] 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1.7fr)_minmax(320px,380px)]">
        <SectionCard
          title="Enrichment queue"
          description={`Review ${showSelectedOnly && visibleSelectedRows.length > 0 ? `${visibleSelectedRows.length} selected companies` : `${filteredRows.length} filtered companies`} and choose one to inspect deeply.`}
          className="xl:min-h-[calc(100vh-20rem)]"
        >
          <div className="space-y-4">
            <div className="surface-muted p-4">
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="micro-label">Filter before enrichment</span>
                  <input
                    type="search"
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.currentTarget.value)}
                    placeholder="Search company, market, website, contact, or review context"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
                  />
                </label>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
                  <label className="space-y-2">
                    <span className="micro-label">Review signal</span>
                    <select
                      value={reviewFilter}
                      onChange={(event) =>
                        setReviewFilter(event.currentTarget.value as ReviewFilter)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                    >
                      <option value="all">All review states</option>
                      <option value="urgent">Urgent review alerts</option>
                      <option value="fresh">Fresh review signals</option>
                      <option value="with_context">Any review context</option>
                      <option value="missing">No review context</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="micro-label">Website state</span>
                    <select
                      value={websiteFilter}
                      onChange={(event) =>
                        setWebsiteFilter(event.currentTarget.value as WebsiteFilter)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                    >
                      <option value="all">All website states</option>
                      <option value="verified">Verified website</option>
                      <option value="candidate">Candidate only</option>
                      <option value="missing">No website yet</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="micro-label">Contact path</span>
                    <select
                      value={contactPathFilter}
                      onChange={(event) =>
                        setContactPathFilter(
                          event.currentTarget.value as ContactPathFilter,
                        )
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                    >
                      <option value="all">All contact paths</option>
                      <option value="named">Named primary path</option>
                      <option value="fallback">Inbox / fallback path</option>
                      <option value="missing">No contact path</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <p>
                  {filteredRows.length} visible • {selectedRows.length} selected •{" "}
                  {queueRows.length} in current queue view
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectVisibleRows}
                    disabled={queueRows.length === 0}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Select visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyIds([])}
                    disabled={selectedCompanyIds.length === 0}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 xl:max-h-[calc(100vh-34rem)] xl:overflow-y-auto xl:pr-1">
              {queueRows.length > 0 ? (
                queueRows.map((row) => (
                  <QueueListItem
                    key={row.companyId}
                    row={row}
                    checked={selectedCompanyIds.includes(row.companyId)}
                    isActive={row.companyId === activeRow?.companyId}
                    onToggle={(checked) => toggleSelected(row.companyId, checked)}
                    onFocus={() => focusCompany(row.companyId)}
                  />
                ))
              ) : (
                <div className="surface-muted p-5">
                  <p className="micro-label">No companies match</p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Try widening the review, website, or contact filter so more companies re-enter the queue before you run enrichment.
                  </p>
                </div>
              )}
            </div>
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
            description="Run enrichment on exactly the slice you want, switch between focus and compare, and keep soft remove separate from true deletion."
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted">
                {compareMode && comparisonRows.length >= 2
                  ? `Compare mode is active for ${comparisonRows.length} selected companies.`
                  : activeRow
                    ? `Focused on ${activeRow.companyName}.`
                    : `Showing ${filteredRows.length} filtered companies in the queue.`}
                {showSelectedOnly && !compareMode ? " Hidden unrelated companies are temporarily removed from the queue list." : ""}
              </p>

              <div className="surface-muted p-4">
                <p className="micro-label">Enrichment scope</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Filter first, then enrich the visible slice, your explicit selection, or the focused company without losing the main profile.
                </p>
              </div>

              <form action={formAction} className="space-y-3">
                {queueRows.map((row) => (
                  <input
                    key={`enrich-visible-${row.companyId}`}
                    type="hidden"
                    name="selectedCompanyIds"
                    value={row.companyId}
                  />
                ))}
                <input type="hidden" name="scope" value="selected" />
                <button
                  type="submit"
                  disabled={isPending || queueRows.length === 0}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Running..." : `Enrich visible (${queueRows.length})`}
                </button>
              </form>

              <form action={formAction} className="space-y-3">
                {selectedCompanyIds.map((companyId) => (
                  <input
                    key={`enrich-selected-${companyId}`}
                    type="hidden"
                    name="selectedCompanyIds"
                    value={companyId}
                  />
                ))}
                <input type="hidden" name="scope" value="selected" />
                <button
                  type="submit"
                  disabled={isPending || selectedCompanyIds.length === 0}
                  className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Running..." : `Enrich selected (${selectedCompanyIds.length})`}
                </button>
              </form>

              <form action={formAction} className="space-y-3">
                <input type="hidden" name="scope" value="queue" />
                <button
                  type="submit"
                  disabled={isPending || view.rows.length === 0}
                  className="w-full rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Enrich full queue
                </button>
              </form>

              {activeRow ? (
                <form action={formAction}>
                  <button
                    type="submit"
                    name="singleCompanyId"
                    value={activeRow.companyId}
                    disabled={isPending}
                    className="w-full rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Enrich focused company
                  </button>
                </form>
              ) : null}

              <div className="grid gap-3">
                <button
                  type="button"
                  disabled={visibleSelectedRows.length === 0}
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
                  disabled={visibleSelectedRows.length !== 1}
                  onClick={() => {
                    if (visibleSelectedRows[0]) {
                      focusCompany(visibleSelectedRows[0].companyId);
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
                    : `${selectedCompanyIds.length} compan${selectedCompanyIds.length === 1 ? "y" : "ies"} selected for compare, enrichment, remove, or delete.`}
                </p>
                {activeRow ? (
                  <p className="mt-2 text-sm text-copy">
                    Focused company: {activeRow.companyName}
                  </p>
                ) : null}
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Queue cleanup</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Soft remove keeps company history and marks it disqualified. Permanent delete removes the company and related activity records.
                </p>

                <form action={removalAction} className="mt-4 space-y-3">
                  {selectedCompanyIds.map((companyId) => (
                    <input
                      key={`remove-selected-${companyId}`}
                      type="hidden"
                      name="selectedCompanyIds"
                      value={companyId}
                    />
                  ))}
                  <label className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/10 p-3 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={confirmRemoval}
                      onChange={(event) => setConfirmRemoval(event.currentTarget.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/15 bg-transparent"
                    />
                    <span>
                      Confirm soft remove. This keeps the company record and notes, but moves it out of the active queue as disqualified.
                    </span>
                  </label>
                  <input
                    type="hidden"
                    name="confirmation"
                    value={confirmRemoval ? "remove_selected" : ""}
                  />
                  <button
                    type="submit"
                    disabled={isRemoving || !confirmRemoval || selectedCompanyIds.length === 0}
                    className="w-full rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRemoving
                      ? "Removing..."
                      : `Remove selected from active queue (${selectedCompanyIds.length})`}
                  </button>
                </form>

                <form action={deleteAction} className="mt-4 space-y-3">
                  {selectedCompanyIds.map((companyId) => (
                    <input
                      key={`delete-selected-${companyId}`}
                      type="hidden"
                      name="selectedCompanyIds"
                      value={companyId}
                    />
                  ))}
                  <label className="space-y-2">
                    <span className="micro-label">Type DELETE to permanently remove</span>
                    <input
                      type="text"
                      name="confirmation"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.currentTarget.value)}
                      placeholder="DELETE"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-rose-400/35 focus:bg-white/[0.05]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      isDeleting ||
                      selectedCompanyIds.length === 0 ||
                      deleteConfirmation !== "DELETE"
                    }
                    className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-copy transition hover:border-rose-400/50 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting
                      ? "Deleting..."
                      : `Delete selected permanently (${selectedCompanyIds.length})`}
                  </button>
                </form>
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
