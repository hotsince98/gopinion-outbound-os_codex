import Link from "next/link";
import type { ReactNode } from "react";
import { PreferredSupportingPageCard } from "@/components/companies/preferred-supporting-page-card";
import { SelectedCompanyProfile } from "@/components/companies/selected-company-profile";
import { WebsiteDiscoveryReviewPanel } from "@/components/companies/website-discovery-review-panel";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getCompaniesWorkspaceView,
  type CompanyListRowView,
} from "@/lib/data/selectors/companies";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Companies",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function FilterGroup(props: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className="surface-soft p-5 lg:p-6">
      <p className="micro-label">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{props.description}</p>
      <div className="mt-5">{props.children}</div>
    </div>
  );
}

function CompanyQueueListItem(props: Readonly<{
  row: CompanyListRowView;
  href: string;
  isSelected: boolean;
}>) {
  const { row } = props;

  return (
    <Link
      href={props.href}
      className={`block rounded-[1.7rem] border p-4 transition ${
        props.isSelected
          ? "surface-elevated border-accent/30"
          : "border-white/8 bg-white/[0.025] hover:border-white/12 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-copy">{row.companyName}</p>
          <p className="mt-1 text-sm text-muted">
            {row.market} • {row.subindustry}
          </p>
        </div>
        <StatusBadge label={row.readinessBadge.label} tone={row.readinessBadge.tone} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label={row.priorityBadge.label} tone={row.priorityBadge.tone} />
        <StatusBadge
          label={row.angleUrgencyBadge.label}
          tone={row.angleUrgencyBadge.tone}
        />
      </div>
      <div className="surface-soft mt-4 p-4">
        <p className="micro-label">Offer focus</p>
        <p className="mt-2 text-sm leading-6 text-copy">{row.recommendedOffer}</p>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-sm text-muted">{row.fitScore}</p>
        <p className="text-sm text-muted">{row.contactCoverage}</p>
      </div>
      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
        {row.decisionMakerConfidence}
      </p>
    </Link>
  );
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const view = await getCompaniesWorkspaceView(await searchParams);
  const selectedCompanyId = view.selectedCompany?.companyId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Companies"
        title="Company intelligence workspace"
        description="Work the queue with a cleaner operator layout: scan accounts on the left, inspect one company deeply in the center, and keep actions on the right."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads/intake"
              className="button-success"
            >
              Create or import leads
            </Link>
            <Link
              href="/leads"
              className="button-primary"
            >
              Open lead queue
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/companies"
                className="button-secondary"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
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

      <FilterPanel
        title="Workspace filters"
        description="Keep the queue readable by shaping it around fit, readiness, and the specific account you want to inspect."
      >
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <input type="hidden" name="companyId" value={selectedCompanyId ?? ""} />
          <FilterGroup
            title="Search and fit"
            description="Narrow the queue by company, market, ICP fit, and priority."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="micro-label">Search</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={view.filters.values.q}
                  placeholder="Search company, market, or contact"
                  className="field-shell"
                />
              </label>

              <label className="space-y-2">
                <span className="micro-label">Industry / ICP</span>
                <select
                  name="icp"
                  defaultValue={view.filters.values.icp}
                  className="field-shell"
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
                  className="field-shell"
                >
                  {view.filters.tierOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </FilterGroup>

          <FilterGroup
            title="Readiness and actions"
            description="Focus the queue on accounts you can work right now, then apply or reset the current view."
          >
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="micro-label">Readiness</span>
                <select
                  name="readiness"
                  defaultValue={view.filters.values.readiness}
                  className="field-shell"
                >
                  {view.filters.readinessOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3 pt-1">
                <button type="submit" className="button-primary">
                  Apply filters
                </button>
                {view.hasActiveFilters ? (
                  <Link href="/companies" className="button-secondary">
                    Reset filters
                  </Link>
                ) : null}
              </div>
            </div>
          </FilterGroup>
        </form>
      </FilterPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(290px,330px)_minmax(0,1.65fr)_minmax(320px,390px)] 2xl:grid-cols-[minmax(310px,350px)_minmax(0,1.8fr)_minmax(340px,410px)]">
        <SectionCard
          title="Company queue"
          description={`${view.resultLabel}. Choose a company to open its full profile.`}
          className="xl:min-h-[calc(100vh-18rem)]"
        >
          {view.rows.length > 0 ? (
            <div className="scrollbar-subtle space-y-3 xl:max-h-[calc(100vh-24rem)] xl:overflow-y-auto xl:pr-1">
              {view.rows.map((row) => (
                <CompanyQueueListItem
                  key={row.companyId}
                  row={row}
                  href={buildPathWithQuery("/companies", view.query, {
                    companyId: row.companyId,
                  })}
                  isSelected={row.companyId === selectedCompanyId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Queue"
              title={view.emptyState.title}
              description={view.emptyState.description}
            />
          )}
        </SectionCard>

        <SelectedCompanyProfile company={view.selectedCompany} />

        <div className="space-y-4">
          {view.selectedCompany ? (
            <>
              <SectionCard
                title="Operator action rail"
                description="Keep the most important next-step context close to the selected company without squeezing the main profile."
              >
                <div className="space-y-4">
                  <div className="surface-muted p-5">
                    <p className="micro-label">Recommended action</p>
                    <p className="mt-3 text-sm leading-6 text-copy">
                      {view.selectedCompany.suggestedNextAction}
                    </p>
                  </div>
                  <div className="surface-muted p-5">
                    <p className="micro-label">Campaign context</p>
                    <div className="mt-3 space-y-3">
                      {view.selectedCompany.campaignSummary.map((item) => (
                        <div
                          key={item}
                          className="surface-soft p-4"
                        >
                          <p className="text-sm leading-6 text-muted">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="surface-muted p-5">
                    <p className="micro-label">Provider transparency</p>
                    <div className="mt-3">
                      <ProviderRunSummary
                        badge={view.selectedCompany.providerTransparency.badge}
                        label={view.selectedCompany.providerTransparency.label}
                        fallback={view.selectedCompany.providerTransparency.fallback}
                        evidence={view.selectedCompany.providerTransparency.evidence}
                        pageUsage={view.selectedCompany.providerTransparency.pageUsage}
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <WebsiteDiscoveryReviewPanel
                companyId={view.selectedCompany.companyId}
                candidateWebsite={view.selectedCompany.websiteDiscovery.candidateUrl}
                officialWebsite={view.selectedCompany.websiteDiscovery.officialWebsite}
                canRejectCandidate={view.selectedCompany.websiteDiscovery.canReviewCandidate}
                confirmationLabel={view.selectedCompany.websiteDiscovery.confirmationBadge.label}
                confirmationTone={view.selectedCompany.websiteDiscovery.confirmationBadge.tone}
                confidenceLabel={view.selectedCompany.websiteDiscovery.confidenceBadge.label}
                sourceLabel={view.selectedCompany.websiteDiscovery.sourceLabel}
                reason={view.selectedCompany.websiteDiscovery.reason}
                candidateDiagnostics={
                  view.selectedCompany.websiteDiscovery.candidateDiagnostics
                }
                reviewSourceLabel={view.selectedCompany.websiteDiscovery.reviewSourceLabel}
                reviewedAtLabel={view.selectedCompany.websiteDiscovery.reviewedAtLabel}
              />

              <PreferredSupportingPageCard
                companyId={view.selectedCompany.companyId}
                currentUrl={view.selectedCompany.preferredSupportingPage.url}
                label={view.selectedCompany.preferredSupportingPage.label}
                sourceLabel={view.selectedCompany.preferredSupportingPage.sourceLabel}
                reason={view.selectedCompany.preferredSupportingPage.reason}
              />

              <CampaignEnrollmentPanel
                title="Campaign assignment"
                description="Assign or enroll the selected company from a focused action rail instead of cramming campaign controls into the profile."
                panel={view.selectedCompany.campaignAssignment}
                autoSelectSingle
              />
            </>
          ) : (
            <SectionCard
              title="Action rail"
              description="Select a company to open website review, preferred page, and campaign actions."
            >
              <EmptyState
                eyebrow="Actions"
                title="No company selected"
                description="The right rail fills in once a company is selected from the queue."
              />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
