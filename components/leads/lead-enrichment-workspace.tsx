"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { runLeadEnrichmentAction } from "@/app/(workspace)/leads/enrichment/actions";
import { initialLeadEnrichmentActionState } from "@/app/(workspace)/leads/enrichment/action-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  LeadEnrichmentQueueRowView,
  LeadEnrichmentWorkspaceView,
} from "@/lib/data/selectors/lead-enrichment";

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

function EnrichmentQueueCard(props: Readonly<{
  row: LeadEnrichmentQueueRowView;
  checked: boolean;
  isPending: boolean;
  onToggle: (checked: boolean) => void;
}>) {
  const { row } = props;

  return (
    <div className="surface-muted min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/companies?companyId=${row.companyId}`}
              className="break-words font-medium text-copy transition hover:text-accent"
            >
              {row.companyName}
            </Link>
            <StatusBadge label={row.readinessBadge.label} tone={row.readinessBadge.tone} />
          </div>
          <p className="text-sm text-muted">
            {row.market} • {row.subindustry}
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            {row.importedLabel} • {row.lastEnrichedLabel}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="selectedCompanyIds"
            value={row.companyId}
            checked={props.checked}
            onChange={(event) => props.onToggle(event.currentTarget.checked)}
            className="h-4 w-4 rounded border-white/15 bg-transparent"
          />
          Select
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={row.websiteDiscoveryBadge.label}
              tone={row.websiteDiscoveryBadge.tone}
            />
            <StatusBadge
              label={row.websiteDiscoveryConfidenceBadge.label}
              tone={row.websiteDiscoveryConfidenceBadge.tone}
            />
          </div>
          <p className="break-words text-sm text-copy">
            {row.website ?? "No website on record"}
          </p>
          <p className="break-words text-sm text-muted">{row.websiteDiscovery}</p>
          <p className="break-words text-sm text-copy">{row.websiteDiscoveryCandidate}</p>
          <p className="break-words text-sm text-muted">
            {row.websiteDiscoverySource} • {row.websiteDiscoveryReason}
          </p>
          <ProviderRunSummary
            badge={row.providerBadge}
            label={row.providerLabel}
            fallback={row.providerFallbackLabel}
            evidence={row.providerEvidence}
            pageUsage={row.supportingPageUsage}
          />
          <p className="break-words text-sm text-copy">{row.preferredSupportingPageLabel}</p>
          <p className="text-sm text-muted">{row.preferredSupportingPageSource}</p>
        </div>

        <div className="min-w-0 space-y-3">
          <p className="text-sm text-copy">{row.angleLabel}</p>
          <p className="text-sm text-muted">{row.angleReason}</p>
          <p className="text-sm text-copy">First offer: {row.recommendedOffer}</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={row.angleUrgencyBadge.label}
              tone={row.angleUrgencyBadge.tone}
            />
            <StatusBadge
              label={row.angleReviewPathBadge.label}
              tone={row.angleReviewPathBadge.tone}
            />
          </div>
          <p className="text-sm text-muted">{row.segmentLabel}</p>
          <p className="text-sm text-muted">{row.noteHintSummary}</p>
          <p className="text-sm text-muted">{row.enrichmentSummary}</p>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-copy">{row.decisionMaker}</p>
          <p className="text-sm text-muted">{row.contactCoverage}</p>
          <ContactRankingStack totalLabel={row.contactCountLabel} items={row.contactCandidates} />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={row.recommendedCampaignStatusBadge.label}
              tone={row.recommendedCampaignStatusBadge.tone}
            />
            <StatusBadge
              label={row.assignmentDecisionBadge.label}
              tone={row.assignmentDecisionBadge.tone}
            />
          </div>
          <p className="text-sm text-copy">{row.recommendedCampaignName}</p>
          <p className="text-sm text-copy">{row.readinessReason}</p>
          <p className="text-sm text-muted">{row.assignmentDecisionReason}</p>
          <p className="text-sm text-muted">{row.missingFieldsLabel}</p>
          <WebsiteDiscoveryReviewActions
            companyId={row.companyId}
            candidateWebsite={row.canReviewWebsiteCandidate ? row.candidateWebsite : undefined}
            officialWebsite={row.website}
            compactLabel="Mark official"
          />
          <button
            type="submit"
            name="singleCompanyId"
            value={row.companyId}
            disabled={props.isPending}
            className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enrich this lead
          </button>
        </div>
      </div>
    </div>
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
                    readiness confidence: {result.confidenceLevel}
                  </p>
                  {result.primaryContactQuality ? (
                    <p className="mt-2 text-sm text-muted">
                      Primary contact quality: {result.primaryContactQuality}
                    </p>
                  ) : null}
                  {result.websiteDiscoverySummary ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.websiteDiscoverySummary}
                    </p>
                  ) : null}
                  {result.websiteDiscoveryCandidate ? (
                    <p className="mt-2 text-sm text-copy">
                      Website candidate: {result.websiteDiscoveryCandidate}
                    </p>
                  ) : null}
                  {result.websiteDiscoveryConfirmationStatus ? (
                    <p className="mt-2 text-sm text-muted">
                      Discovery status:{" "}
                      {result.websiteDiscoveryConfirmationStatus.replaceAll("_", " ")} •{" "}
                      website confidence: {result.websiteDiscoveryConfidenceLevel ?? "none"}
                      {result.websiteDiscoveryConfidenceScore != null
                        ? ` (${result.websiteDiscoveryConfidenceScore}/100)`
                        : ""}
                    </p>
                  ) : null}
                  {result.providerUsed ? (
                    <p className="mt-2 text-sm text-copy">
                      {result.providerCrawlAttempted === false
                        ? result.providerInputStatus === "candidate_website"
                          ? `Provider: requested ${result.providerRequested ?? result.providerUsed} • crawl held pending website review`
                          : `Provider: requested ${result.providerRequested ?? result.providerUsed} • discovery ended before crawl`
                        : `Provider: requested ${result.providerRequested ?? result.providerUsed} • ran ${result.providerUsed}${result.providerFallbackUsed ? " fallback" : ""}`}
                    </p>
                  ) : null}
                  {result.providerInputStatus ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.providerInputStatus === "confirmed_website"
                        ? `Crawler input: confirmed website ${result.providerInputWebsite ?? "available"}`
                        : result.providerInputStatus === "candidate_website"
                          ? `Crawler input held: candidate website ${result.providerInputWebsite ?? "pending"} still needs confirmation`
                          : "Crawler input: no confirmed website was available"}
                    </p>
                  ) : null}
                  {result.providerCrawledWebsite ? (
                    <p className="mt-2 text-sm text-muted">
                      Crawler website: {result.providerCrawledWebsite}
                    </p>
                  ) : null}
                  {result.providerFallbackReason ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.providerFallbackReason}
                    </p>
                  ) : null}
                  {result.providerEvidence[0] ? (
                    <p className="mt-2 text-sm text-muted">
                      Provider evidence: {result.providerEvidence.slice(0, 2).join(" • ")}
                    </p>
                  ) : null}
                  {result.discoveryEvidence[0] ? (
                    <p className="mt-2 text-sm text-copy">
                      Discovery evidence: {result.discoveryEvidence.slice(0, 2).join(" • ")}
                    </p>
                  ) : null}
                  {result.preferredSupportingPageUrl ? (
                    <p className="mt-2 text-sm text-copy">
                      Preferred page: {result.preferredSupportingPageUrl} •{" "}
                      {result.preferredSupportingPageSource?.replaceAll("_", " ") ??
                        "saved"}
                    </p>
                  ) : null}
                  {result.preferredSupportingPageReason ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.preferredSupportingPageReason}
                    </p>
                  ) : null}
                  {result.staffPageUrls[0] || result.contactPageUrls[0] ? (
                    <p className="mt-2 text-sm text-muted">
                      Pages:{" "}
                      {[
                        result.staffPageUrls[0]
                          ? `${result.staffPageUrls.length} staff/team`
                          : undefined,
                        result.contactPageUrls[0]
                          ? `${result.contactPageUrls.length} contact`
                          : undefined,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" • ")}
                    </p>
                  ) : null}
                  {result.foundNames[0] ? (
                    <p className="mt-2 text-sm text-muted">
                      People clues: {result.foundNames.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                  {result.noteHintSummary ? (
                    <p className="mt-2 text-sm text-muted">
                      {result.noteHintSummary}
                    </p>
                  ) : null}
                  {result.segmentLabel ? (
                    <p className="mt-2 text-sm text-muted">
                      Segment: {result.segmentLabel}
                    </p>
                  ) : null}
                  {result.angleLabel ? (
                    <p className="mt-2 text-sm text-copy">
                      Angle: {result.angleLabel}
                      {result.angleReason ? ` • ${result.angleReason}` : ""}
                    </p>
                  ) : null}
                  {result.angleReviewPath ? (
                    <p className="mt-2 text-sm text-muted">
                      Review path: {result.angleReviewPath.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {result.primaryContactSource ? (
                    <p className="mt-2 text-sm text-muted">
                      Source: {result.primaryContactSource}
                    </p>
                  ) : null}
                  {result.primaryContactSelectionReason ? (
                    <p className="mt-2 text-sm text-copy">
                      Why chosen: {result.primaryContactSelectionReason}
                    </p>
                  ) : null}
                  {result.secondaryContactLabels[0] ? (
                    <p className="mt-2 text-sm text-muted">
                      Secondary: {result.secondaryContactLabels[0]}
                    </p>
                  ) : null}
                  {result.backupContactLabels[0] ? (
                    <p className="mt-2 text-sm text-muted">
                      Backups: {result.backupContactLabels.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-copy">{result.readinessReason}</p>
                  {result.qualityWarnings[0] ? (
                    <p className="mt-2 text-sm text-warning">
                      Warning: {result.qualityWarnings[0]}
                    </p>
                  ) : null}
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
                Run website discovery when a lead has no site on record, parse
                imported notes into structured hints, then scan the company’s
                public web presence for emails, phones, and operator clues.
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

        <div className="grid gap-4 2xl:hidden">
          {view.rows.map((row) => (
            <EnrichmentQueueCard
              key={row.companyId}
              row={row}
              checked={selectedCompanyIds.includes(row.companyId)}
              isPending={isPending}
              onToggle={(checked) => toggleSelected(row.companyId, checked)}
            />
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-white/8 bg-black/10 2xl:block">
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
                    "Website / discovery",
                    "Angle / evidence",
                    "Contact path",
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
                          <StatusBadge
                            label={row.readinessBadge.label}
                            tone={row.readinessBadge.tone}
                          />
                        </div>
                        <p className="text-sm text-muted">
                          {row.market} • {row.subindustry}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">
                          {row.importedLabel} • {row.lastEnrichedLabel}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            label={row.websiteDiscoveryBadge.label}
                            tone={row.websiteDiscoveryBadge.tone}
                          />
                          <StatusBadge
                            label={row.websiteDiscoveryConfidenceBadge.label}
                            tone={row.websiteDiscoveryConfidenceBadge.tone}
                          />
                        </div>
                        <p className="text-sm text-copy">
                          {row.website ?? "No website on record"}
                        </p>
                        <p className="text-sm text-muted">{row.websiteDiscovery}</p>
                        <p className="text-sm text-copy">
                          {row.websiteDiscoveryCandidate}
                        </p>
                        <p className="text-sm text-muted">
                          {row.websiteDiscoverySource}
                        </p>
                        <p className="text-sm text-muted">
                          {row.websiteDiscoveryReason}
                        </p>
                        <ProviderRunSummary
                          badge={row.providerBadge}
                          label={row.providerLabel}
                          fallback={row.providerFallbackLabel}
                          evidence={row.providerEvidence}
                          pageUsage={row.supportingPageUsage}
                        />
                        <p className="text-sm text-copy">
                          {row.preferredSupportingPageLabel}
                        </p>
                        <p className="text-sm text-muted">
                          {row.preferredSupportingPageSource}
                        </p>
                        <WebsiteDiscoveryReviewActions
                          companyId={row.companyId}
                          candidateWebsite={
                            row.canReviewWebsiteCandidate
                              ? row.candidateWebsite
                              : undefined
                          }
                          officialWebsite={row.website}
                          compactLabel="Mark official"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="text-sm text-copy">{row.angleLabel}</p>
                        <p className="text-sm text-muted">{row.angleReason}</p>
                        <p className="text-sm text-copy">
                          First offer: {row.recommendedOffer}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            label={row.angleUrgencyBadge.label}
                            tone={row.angleUrgencyBadge.tone}
                          />
                          <StatusBadge
                            label={row.angleReviewPathBadge.label}
                            tone={row.angleReviewPathBadge.tone}
                          />
                        </div>
                        <p className="text-sm text-muted">{row.segmentLabel}</p>
                        <p className="text-sm text-muted">{row.noteHintSummary}</p>
                        <p className="text-sm text-muted">{row.enrichmentSummary}</p>
                        <ConfidenceBreakdown
                          items={[
                            {
                              label: "Website discovery",
                              badge: row.websiteDiscoveryConfidenceBadge,
                            },
                            {
                              label: "Primary contact quality",
                              badge: row.contactConfidenceBadge,
                            },
                            {
                              label: "Angle confidence",
                              badge: row.angleConfidenceBadge,
                            },
                            {
                              label: "Readiness confidence",
                              badge: row.readinessConfidenceBadge,
                            },
                          ]}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="text-sm text-copy">{row.decisionMaker}</p>
                        <p className="text-sm text-muted">{row.contactCoverage}</p>
                        <ContactRankingStack
                          totalLabel={row.contactCountLabel}
                          items={row.contactCandidates}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            label={row.recommendedCampaignStatusBadge.label}
                            tone={row.recommendedCampaignStatusBadge.tone}
                          />
                          <StatusBadge
                            label={row.assignmentDecisionBadge.label}
                            tone={row.assignmentDecisionBadge.tone}
                          />
                        </div>
                        <p className="text-sm text-copy">
                          {row.recommendedCampaignName}
                        </p>
                        <p className="text-sm text-copy">{row.readinessReason}</p>
                        <p className="text-sm text-muted">
                          {row.assignmentDecisionReason}
                        </p>
                        <p className="text-sm text-muted">{row.missingFieldsLabel}</p>
                        <button
                          type="submit"
                          name="singleCompanyId"
                          value={row.companyId}
                          disabled={isPending}
                          className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Enrich this lead
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </form>

      <CampaignEnrollmentPanel
        title="Campaign assignment and enrollment"
        description="Once enrichment sharpens the angle and contact path, move leads into the best-fit campaign, enroll the strong ones now, and push weaker paths into review instead of forcing them into outreach."
        panel={view.campaignAssignment}
      />
    </div>
  );
}
