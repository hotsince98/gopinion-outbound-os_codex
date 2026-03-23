import Link from "next/link";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getCompaniesWorkspaceView } from "@/lib/data/selectors/companies";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Companies",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompaniesPage({ searchParams }: PageProps) {
  const view = await getCompaniesWorkspaceView(await searchParams);

  const rows = view.rows.map((row) => ({
    id: row.companyId,
    cells: [
      <div key={`${row.companyId}-company`} className="space-y-2">
        <Link
          href={buildPathWithQuery("/companies", view.query, {
            companyId: row.companyId,
          })}
          className="font-medium text-copy transition hover:text-accent"
        >
          {row.companyName}
        </Link>
        <p className="text-sm text-muted">
          {row.market} • {row.subindustry}
        </p>
      </div>,
      <span key={`${row.companyId}-reviews`} className="text-sm text-copy">
        {row.reviewSnapshot}
      </span>,
      <div key={`${row.companyId}-fit`} className="space-y-2">
        <StatusBadge
          label={row.priorityBadge.label}
          tone={row.priorityBadge.tone}
        />
        <p className="text-sm text-muted">{row.fitScore}</p>
      </div>,
      <span key={`${row.companyId}-offer`} className="text-sm text-copy">
        {row.recommendedOffer}
      </span>,
      <div key={`${row.companyId}-contact`} className="space-y-1">
        <p className="text-sm text-copy">{row.contactCoverage}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.decisionMakerConfidence}
        </p>
      </div>,
      <div key={`${row.companyId}-readiness`} className="space-y-2">
        <StatusBadge
          label={row.readinessBadge.label}
          tone={row.readinessBadge.tone}
        />
        <p className="text-sm text-muted">{row.campaignStatus}</p>
      </div>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Companies"
        title="Company intelligence workspace"
        description="Inspect dealer fit, review health, contact coverage, and readiness without leaving the operational shell. The view stays backed by selectors and typed entities so the next persistence step can slot in cleanly."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Open lead queue
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/companies"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <FilterPanel>
        <form className="grid gap-4 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <label className="space-y-2">
            <span className="micro-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={view.filters.values.q}
              placeholder="Search company, market, or contact"
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
            <span className="micro-label">Readiness</span>
            <select
              name="readiness"
              defaultValue={view.filters.values.readiness}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.readinessOptions.map((option) => (
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Company intelligence queue"
          description={`${view.resultLabel}. Select a company to inspect its fit, reputation posture, and decision-maker coverage.`}
        >
          <TableShell
            columns={[
              "Company",
              "Reviews",
              "Fit / priority",
              "Recommended offer",
              "Contact coverage",
              "Readiness",
            ]}
            rows={rows}
            emptyTitle={view.emptyState.title}
            emptyDescription={view.emptyState.description}
          />
        </SectionCard>

        <SectionCard
          title="Selected company"
          description="A first-pass profile assembled from typed company, contact, offer, and campaign records."
        >
          {view.selectedCompany ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={view.selectedCompany.priorityBadge.label}
                    tone={view.selectedCompany.priorityBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedCompany.statusBadge.label}
                    tone={view.selectedCompany.statusBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedCompany.readinessBadge.label}
                    tone={view.selectedCompany.readinessBadge.tone}
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-copy">
                    {view.selectedCompany.companyName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {view.selectedCompany.market} • {view.selectedCompany.subindustry} •{" "}
                    {view.selectedCompany.icpLabel}
                  </p>
                </div>
                <div className="surface-muted p-4">
                  <p className="micro-label">Suggested next action</p>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedCompany.suggestedNextAction}
                  </p>
                </div>
              </div>

              <DetailList items={view.selectedCompany.basics} />
              <DetailList items={view.selectedCompany.reputation} />

              <div className="surface-muted p-4">
                <p className="micro-label">Recommended offer</p>
                <p className="mt-3 text-base font-medium text-copy">
                  {view.selectedCompany.recommendedOffer.name}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {view.selectedCompany.recommendedOffer.description}
                </p>
                <p className="mt-3 text-sm leading-6 text-copy">
                  {view.selectedCompany.recommendedOffer.angle}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {view.selectedCompany.recommendedOffer.cta}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-muted p-4">
                  <p className="micro-label">Likely pains / notes</p>
                  <div className="mt-3 space-y-2">
                    {[...view.selectedCompany.pains, ...view.selectedCompany.notes].map(
                      (item) => (
                        <p key={item} className="text-sm leading-6 text-muted">
                          {item}
                        </p>
                      ),
                    )}
                  </div>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Campaign context</p>
                  <div className="mt-3 space-y-2">
                    {view.selectedCompany.campaignSummary.map((item) => (
                      <p key={item} className="text-sm leading-6 text-muted">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Decision-maker coverage</p>
                <div className="mt-3 space-y-3">
                  {view.selectedCompany.contacts.length > 0 ? (
                    view.selectedCompany.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="rounded-2xl border border-white/8 bg-black/10 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-copy">{contact.name}</p>
                            <p className="mt-1 text-sm text-muted">{contact.role}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted">
                              {contact.confidence}
                            </p>
                            <p className="mt-1 text-sm text-copy">{contact.status}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted">{contact.source}</p>
                        {contact.notes.map((note) => (
                          <p key={note} className="mt-2 text-sm leading-6 text-muted">
                            {note}
                          </p>
                        ))}
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      eyebrow="Contacts"
                      title="No decision-maker coverage yet"
                      description="This company still needs contact sourcing before outreach can become operational."
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="Company detail"
              title="Select a company to inspect it"
              description="When at least one company is in view, this panel will show its fit signals, recommended offer, and decision-maker coverage."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
