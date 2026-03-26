import Link from "next/link";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getLeadsWorkspaceView } from "@/lib/data/selectors/leads";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Leads",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeadsPage({ searchParams }: PageProps) {
  const view = await getLeadsWorkspaceView(await searchParams);

  const queueItems = view.queueTabs.map((tab) => ({
    href: buildPathWithQuery("/leads", view.query, {
      queue: tab.value === "all" ? null : tab.value,
    }),
    label: tab.label,
    count: tab.count,
    isActive: tab.active,
  }));

  const rows = view.rows.map((row) => ({
    id: row.companyId,
    cells: [
      <div key={`${row.companyId}-company`} className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/companies?companyId=${row.companyId}`}
            className="font-medium text-copy transition hover:text-accent"
          >
            {row.companyName}
          </Link>
          <StatusBadge label={row.queueBadge.label} tone={row.queueBadge.tone} />
        </div>
        <p className="text-sm text-muted">
          {row.market} • {row.subindustry}
        </p>
        <p className="text-sm text-muted">{row.icpLabel}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.importedLabel} • {row.sourceLabel}
        </p>
      </div>,
      <div key={`${row.companyId}-priority`} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={row.priorityBadge.label}
            tone={row.priorityBadge.tone}
          />
          <StatusBadge
            label={row.angleUrgencyBadge.label}
            tone={row.angleUrgencyBadge.tone}
          />
        </div>
        <p className="text-sm text-copy">{row.angleLabel}</p>
        <p className="text-sm text-muted">{row.segmentLabel}</p>
      </div>,
      <div key={`${row.companyId}-enrichment`} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={row.enrichmentBadge.label}
            tone={row.enrichmentBadge.tone}
          />
          <StatusBadge
            label={row.websiteDiscoveryBadge.label}
            tone={row.websiteDiscoveryBadge.tone}
          />
          <StatusBadge
            label={row.websiteDiscoveryConfidenceBadge.label}
            tone={row.websiteDiscoveryConfidenceBadge.tone}
          />
        </div>
        <p className="text-sm text-copy">{row.websiteDiscovery}</p>
        <p className="text-sm text-copy">{row.websiteDiscoveryCandidate}</p>
        <p className="text-sm text-muted">
          {row.websiteDiscoverySource} • {row.websiteDiscoveryReason}
        </p>
        <p className="text-sm text-muted">
          {row.preferredSupportingPageLabel} • {row.preferredSupportingPageSource}
        </p>
        <ProviderRunSummary
          badge={row.providerBadge}
          label={row.providerLabel}
          fallback={row.providerFallbackLabel}
          evidence={row.providerEvidence}
          pageUsage={row.supportingPageUsage}
        />
        <p className="text-sm text-muted">{row.noteHintSummary}</p>
      </div>,
      <div key={`${row.companyId}-status`} className="space-y-2">
        <StatusBadge
          label={row.statusBadge.label}
          tone={row.statusBadge.tone}
        />
        <p className="text-sm text-copy">{row.workflowReason}</p>
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
      </div>,
      <div key={`${row.companyId}-offer`} className="space-y-2">
        <p className="text-sm font-medium text-copy">{row.recommendedOffer}</p>
        <p className="text-sm text-copy">{row.angleReason}</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={row.angleReviewPathBadge.label}
            tone={row.angleReviewPathBadge.tone}
          />
        </div>
        <p className="text-sm text-muted">{row.segmentAngle}</p>
      </div>,
      <div key={`${row.companyId}-contact`} className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.decisionMakerConfidence}
        </p>
        <p className="text-sm text-muted">{row.contactCoverage}</p>
        <ContactRankingStack
          totalLabel={row.contactCountLabel}
          items={row.contactCandidates}
        />
      </div>,
      <div key={`${row.companyId}-action`} className="space-y-2">
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
        <p className="text-sm text-muted">{row.assignmentDecisionReason}</p>
        <p className="text-sm text-copy">{row.websiteLabel}</p>
        <p className="text-sm text-muted">{row.enrichmentSummary}</p>
        <p className="text-sm text-muted">{row.missingFieldsLabel}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.lastEnrichedLabel}
        </p>
        <p className="text-sm leading-6 text-copy">{row.nextAction}</p>
        <WebsiteDiscoveryReviewActions
          companyId={row.companyId}
          candidateWebsite={row.canReviewWebsiteCandidate ? row.candidateWebsite : undefined}
          officialWebsite={row.officialWebsite}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/companies?companyId=${row.companyId}`}
            className="text-sm font-medium text-accent transition hover:text-copy"
          >
            Open company profile
          </Link>
          <Link
            href="/leads/enrichment"
            className="text-sm font-medium text-warning transition hover:text-copy"
          >
            Open enrichment queue
          </Link>
        </div>
      </div>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Intake"
        title="Prospect intake and review queue"
        description="Work the top of funnel using typed lead records, website discovery, notes parsing, and enrichment-readiness signals. The selector layer keeps the workflow logic out of the UI while operators get a sharper daily queue."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads/intake"
              className="rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15"
            >
              Create or import leads
            </Link>
            <Link
              href="/leads/enrichment"
              className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15"
            >
              Run enrichment
            </Link>
            <Link
              href="/companies"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Open company intelligence
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/leads"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {view.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            change={stat.change}
            tone={stat.tone}
          />
        ))}
      </div>

      <SegmentedControl items={queueItems} />

      <FilterPanel>
        <form className="space-y-4">
          <input
            type="hidden"
            name="queue"
            value={view.filters.values.queue === "all" ? "" : view.filters.values.queue}
          />

          <div className="grid gap-4 xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] xl:items-end">
            <label className="space-y-2">
              <span className="micro-label">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={view.filters.values.q}
                placeholder="Search company, market, source, website, or contact"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
              />
            </label>

            <label className="space-y-2">
              <span className="micro-label">Industry / ICP</span>
              <select
                name="icp"
                defaultValue={view.filters.values.icp}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.icpOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Priority tier</span>
              <select
                name="tier"
                defaultValue={view.filters.values.tier}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.tierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Enrichment</span>
              <select
                name="enrichment"
                defaultValue={view.filters.values.enrichment}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.enrichmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Company status</span>
              <select
                name="status"
                defaultValue={view.filters.values.status}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Sort</span>
              <select
                name="sort"
                defaultValue={view.filters.values.sort}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="micro-label">Imported</span>
              <select
                name="imported"
                defaultValue={view.filters.values.imported}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.importedOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Enriched</span>
              <select
                name="enriched"
                defaultValue={view.filters.values.enriched}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.enrichedOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">State / province</span>
              <select
                name="state"
                defaultValue={view.filters.values.state}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.stateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">City</span>
              <select
                name="city"
                defaultValue={view.filters.values.city}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.cityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Source</span>
              <select
                name="source"
                defaultValue={view.filters.values.source}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Readiness confidence</span>
              <select
                name="confidence"
                defaultValue={view.filters.values.confidence}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.confidenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
            <label className="space-y-2">
              <span className="micro-label">Website</span>
              <select
                name="website"
                defaultValue={view.filters.values.website}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.websiteOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Contact path</span>
              <select
                name="contact"
                defaultValue={view.filters.values.contact}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.contactOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Primary contact</span>
              <select
                name="primary"
                defaultValue={view.filters.values.primary}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
              >
                {view.filters.primaryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Apply filters
            </button>
          </div>
        </form>
      </FilterPanel>

      <SectionCard
        title="Campaign assignment"
        description="Select visible leads, review the recommended campaign and first offer, then assign or enroll them directly from the enriched intake queue."
      >
        <CampaignEnrollmentPanel
          title="Campaign assignment and enrollment"
          description="Use angle, readiness, and contact-quality guidance to move qualified leads into the right campaign. Review-only leads can still be assigned without being enrolled prematurely."
          panel={view.campaignAssignment}
        />
      </SectionCard>

      <SectionCard
        title="Lead queue"
        description={`${view.resultLabel}. Work recent imports, website gaps, and review-ready records without losing the stronger-review segments that need a different angle instead of exclusion.`}
      >
        <TableShell
          columns={[
            "Company",
            "Priority / angle",
            "Enrichment",
            "Workflow",
            "First offer / routing",
            "Primary contact",
            "Next action",
          ]}
          rows={rows}
          emptyTitle={view.emptyState.title}
          emptyDescription={view.emptyState.description}
        />
      </SectionCard>
    </div>
  );
}
