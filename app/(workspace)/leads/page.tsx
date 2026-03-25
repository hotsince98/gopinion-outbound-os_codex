import Link from "next/link";
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
          <StatusBadge
            label={row.queueBadge.label}
            tone={row.queueBadge.tone}
          />
        </div>
        <p className="text-sm text-muted">
          {row.market} • {row.subindustry}
        </p>
        <p className="text-sm text-muted">{row.icpLabel}</p>
      </div>,
      <StatusBadge
        key={`${row.companyId}-priority`}
        label={row.priorityBadge.label}
        tone={row.priorityBadge.tone}
      />,
      <StatusBadge
        key={`${row.companyId}-enrichment`}
        label={row.enrichmentBadge.label}
        tone={row.enrichmentBadge.tone}
      />,
      <StatusBadge
        key={`${row.companyId}-status`}
        label={row.statusBadge.label}
        tone={row.statusBadge.tone}
      />,
      <div key={`${row.companyId}-offer`} className="space-y-1">
        <p className="text-sm font-medium text-copy">{row.recommendedOffer}</p>
      </div>,
      <div key={`${row.companyId}-contact`} className="space-y-1">
        <p className="text-sm text-copy">{row.decisionMaker}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.decisionMakerConfidence}
        </p>
        <p className="text-sm text-muted">{row.contactCoverage}</p>
        <p className="text-sm text-muted">{row.primaryContactSource}</p>
        {row.primaryContactWarnings[0] ? (
          <p className="text-sm text-warning">{row.primaryContactWarnings[0]}</p>
        ) : null}
      </div>,
      <div key={`${row.companyId}-action`} className="space-y-2">
        <StatusBadge
          label={row.confidenceBadge.label}
          tone={row.confidenceBadge.tone}
        />
        <p className="text-sm text-muted">{row.enrichmentSummary}</p>
        <p className="text-sm text-muted">{row.missingFieldsLabel}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.lastEnrichedLabel}
        </p>
        <p className="text-sm leading-6 text-copy">{row.readinessReason}</p>
        <p className="text-sm leading-6 text-copy">{row.nextAction}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/companies?companyId=${row.companyId}`}
            className="text-sm font-medium text-accent transition hover:text-copy"
          >
            Open company profile
          </Link>
          {row.queueBadge.label === "Needs enrichment" ? (
            <Link
              href="/leads/enrichment"
              className="text-sm font-medium text-warning transition hover:text-copy"
            >
              Open enrichment queue
            </Link>
          ) : null}
        </div>
      </div>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Intake"
        title="Prospect intake and review queue"
        description="Work the top of funnel using typed lead records, ICP metadata, and company readiness signals. This page keeps the intake queue operational without pushing business logic into the UI."
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
        <form className="grid gap-4 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <input
            type="hidden"
            name="queue"
            value={view.filters.values.queue === "all" ? "" : view.filters.values.queue}
          />

          <label className="space-y-2">
            <span className="micro-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={view.filters.values.q}
              placeholder="Search company, market, ICP, or contact"
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

          <button
            type="submit"
            className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
          >
            Apply filters
          </button>
        </form>
      </FilterPanel>

      <SectionCard
        title="Lead queue"
        description={`${view.resultLabel}. Review the strongest dealers first, then clear anything blocked on enrichment or contact validation.`}
      >
        <TableShell
          columns={[
            "Company",
            "Priority",
            "Enrichment",
            "Status",
            "Recommended offer",
            "Decision-maker / coverage",
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
