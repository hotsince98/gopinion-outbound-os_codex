import Link from "next/link";
import type { ReactNode } from "react";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { SavedWorkspaceViewsBar } from "@/components/leads/saved-workspace-views-bar";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { SelectedCompanyProfile } from "@/components/companies/selected-company-profile";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { RecentReviewList } from "@/components/reviews/recent-review-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getLeadsWorkspaceView,
  type LeadRowView,
} from "@/lib/data/selectors/leads";
import { getLeadWorkspaceViewPresets } from "@/lib/data/workspace-views/leads";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Leads",
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
    <div className="surface-muted p-4 lg:p-5">
      <p className="micro-label">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{props.description}</p>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function LeadQueueListItem(props: Readonly<{
  row: LeadRowView;
  href: string;
  isSelected: boolean;
}>) {
  const { row } = props;

  return (
    <Link
      href={props.href}
      className={`block rounded-3xl border p-4 transition ${
        props.isSelected
          ? "border-accent/35 bg-accent/10"
          : "border-white/8 bg-black/10 hover:border-white/12 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-copy">{row.companyName}</p>
          <p className="mt-1 text-sm text-muted">
            {row.market} • {row.subindustry}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
            {row.importedLabel}
          </p>
        </div>
        <StatusBadge label={row.queueBadge.label} tone={row.queueBadge.tone} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label={row.priorityBadge.label} tone={row.priorityBadge.tone} />
        <StatusBadge
          label={row.websiteDiscoveryBadge.label}
          tone={row.websiteDiscoveryBadge.tone}
        />
        <StatusBadge
          label={row.latestReviewBadge.label}
          tone={row.latestReviewBadge.tone}
        />
      </div>
      <p className="mt-3 text-sm text-copy">{row.recommendedOffer}</p>
      <p className="mt-2 text-sm text-muted">{row.latestReviewSummary}</p>
      <p className="mt-1 text-sm text-muted">{row.latestReviewMetaLabel}</p>
      <div className="mt-3">
        <RecentReviewList
          items={row.recentReviews}
          maxItems={2}
          compact
          emptyMessage="No recent review snippets are attached yet."
        />
      </div>
      <p className="mt-2 text-sm text-muted">{row.workflowReason}</p>
      <p className="mt-2 text-sm text-muted">{row.contactCoverage}</p>
    </Link>
  );
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const view = await getLeadsWorkspaceView(await searchParams);
  const selectedCompanyId = view.selectedCompany?.companyId;
  const savedViewQuery = Object.fromEntries(
    Object.entries(view.query).filter(([key]) => key !== "companyId"),
  );
  const selectedLead = selectedCompanyId
    ? view.rows.find((row) => row.companyId === selectedCompanyId)
    : undefined;

  const queueItems = view.queueTabs.map((tab) => ({
    href: buildPathWithQuery("/leads", view.query, {
      queue: tab.value === "all" ? null : tab.value,
    }),
    label: tab.label,
    count: tab.count,
    isActive: tab.active,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Intake"
        title="Prospect intake and review queue"
        description="Default to an operator rhythm that fits a laptop: scan the queue on the left, inspect one company deeply in the center, and take action from the right rail."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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

      <SavedWorkspaceViewsBar
        path="/leads"
        currentQuery={savedViewQuery}
        presets={getLeadWorkspaceViewPresets()}
      />

      <FilterPanel
        title="Queue filters"
        description="Shape the lead queue around fit, freshness, geography, and contact coverage without compressing every control into a wide dense strip."
        bodyClassName="space-y-4"
      >
        <form className="space-y-4">
          <input
            type="hidden"
            name="queue"
            value={view.filters.values.queue === "all" ? "" : view.filters.values.queue}
          />
          <input type="hidden" name="companyId" value={selectedCompanyId ?? ""} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <FilterGroup
              title="Core queue shaping"
              description="Start with the search, ICP, readiness, and sorting controls you use most often."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
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
                <label className="space-y-2 md:col-span-2">
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
            </FilterGroup>

            <FilterGroup
              title="Timing and coverage"
              description="Use time windows, geography, and coverage filters to shrink the queue to what matters right now."
            >
              <div className="grid gap-4 md:grid-cols-2">
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
                  <span className="micro-label">Review signal</span>
                  <select
                    name="review"
                    defaultValue={view.filters.values.review}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                  >
                    {view.filters.reviewOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="micro-label">Website state</span>
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
                  <span className="micro-label">Website review</span>
                  <select
                    name="websiteReview"
                    defaultValue={view.filters.values.websiteReview}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                  >
                    {view.filters.websiteReviewOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="micro-label">Contact coverage</span>
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
                  <span className="micro-label">Primary contact path</span>
                  <select
                    name="contactPath"
                    defaultValue={view.filters.values.contactPath}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
                  >
                    {view.filters.contactPathOptions.map((option) => (
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
                <label className="space-y-2">
                  <span className="micro-label">Confidence</span>
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

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
                >
                  Apply filters
                </button>
                {view.hasActiveFilters ? (
                  <Link
                    href="/leads"
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
                  >
                    Reset filters
                  </Link>
                ) : null}
              </div>
            </FilterGroup>
          </div>
        </form>
      </FilterPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1.55fr)_minmax(300px,360px)] 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1.7fr)_minmax(320px,380px)]">
        <SectionCard
          title="Lead queue"
          description={`${view.resultLabel}. Choose a lead to promote it into the main review profile.`}
          className="xl:min-h-[calc(100vh-20rem)]"
        >
          {view.rows.length > 0 ? (
            <div className="space-y-3 xl:max-h-[calc(100vh-26rem)] xl:overflow-y-auto xl:pr-1">
              {view.rows.map((row) => (
                <LeadQueueListItem
                  key={row.companyId}
                  row={row}
                  href={buildPathWithQuery("/leads", view.query, {
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
          {view.selectedCompany && selectedLead ? (
            <>
              <SectionCard
                title="Action rail"
                description="Keep review actions, contact quality, and campaign routing next to the selected company."
              >
                <div className="space-y-4">
                  <div className="surface-muted p-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        label={selectedLead.recommendedCampaignStatusBadge.label}
                        tone={selectedLead.recommendedCampaignStatusBadge.tone}
                      />
                      <StatusBadge
                        label={selectedLead.assignmentDecisionBadge.label}
                        tone={selectedLead.assignmentDecisionBadge.tone}
                      />
                    </div>
                    <p className="mt-3 text-sm font-medium text-copy">
                      {selectedLead.recommendedCampaignName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-copy">
                      {selectedLead.nextAction}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {selectedLead.assignmentDecisionReason}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {selectedLead.missingFieldsLabel}
                    </p>
                  </div>

                  <div className="surface-muted p-4">
                    <p className="micro-label">Website review</p>
                    <p className="mt-3 break-words text-sm text-copy">
                      {selectedLead.websiteLabel}
                    </p>
                    <p className="mt-2 break-words text-sm text-muted">
                      {selectedLead.websiteDiscoverySource} • {selectedLead.websiteDiscoveryReason}
                    </p>
                    <div className="mt-4">
                      <WebsiteDiscoveryReviewActions
                        companyId={selectedLead.companyId}
                        candidateWebsite={
                          selectedLead.canReviewWebsiteCandidate
                            ? selectedLead.candidateWebsite
                            : undefined
                        }
                        officialWebsite={selectedLead.officialWebsite}
                      />
                    </div>
                  </div>

                  <div className="surface-muted p-4">
                    <p className="micro-label">Provider and contact signals</p>
                    <div className="mt-3">
                      <ProviderRunSummary
                        badge={selectedLead.providerBadge}
                        label={selectedLead.providerLabel}
                        fallback={selectedLead.providerFallbackLabel}
                        evidence={selectedLead.providerEvidence}
                        pageUsage={selectedLead.supportingPageUsage}
                      />
                    </div>
                    <div className="mt-4">
                      <ConfidenceBreakdown
                        items={[
                          {
                            label: "Website discovery",
                            badge: selectedLead.websiteDiscoveryConfidenceBadge,
                          },
                          {
                            label: "Primary contact quality",
                            badge: selectedLead.contactConfidenceBadge,
                          },
                          {
                            label: "Angle confidence",
                            badge: selectedLead.angleConfidenceBadge,
                          },
                          {
                            label: "Readiness confidence",
                            badge: selectedLead.readinessConfidenceBadge,
                          },
                        ]}
                      />
                    </div>
                    <div className="mt-4">
                      <ContactRankingStack
                        totalLabel={selectedLead.contactCountLabel}
                        items={selectedLead.contactCandidates}
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <CampaignEnrollmentPanel
                title="Campaign assignment"
                description="Assign or enroll the selected lead from a dedicated rail so campaign actions no longer compete with the profile for width."
                panel={view.selectedCompany.campaignAssignment}
                autoSelectSingle
              />
            </>
          ) : (
            <SectionCard
              title="Action rail"
              description="Select a lead to open its review actions, provider diagnostics, and campaign controls."
            >
              <EmptyState
                eyebrow="Actions"
                title="No lead selected"
                description="The right rail fills in once a company is selected from the lead queue."
              />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
