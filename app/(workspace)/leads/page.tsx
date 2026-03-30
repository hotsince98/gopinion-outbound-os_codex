import Link from "next/link";
import type { ReactNode } from "react";
import {
  CompanyProfileSection,
  SelectedCompanyProfile,
} from "@/components/companies/selected-company-profile";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { SavedWorkspaceViewsBar } from "@/components/leads/saved-workspace-views-bar";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
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

type WorkspaceMode = "queue" | "focus";

const ADVANCED_FILTER_KEYS = [
  "icp",
  "tier",
  "enrichment",
  "status",
  "imported",
  "enriched",
  "state",
  "city",
  "websiteReview",
  "contact",
  "primary",
  "confidence",
] as const;

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function FilterGroup(props: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className="surface-muted p-5">
      <p className="micro-label">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{props.description}</p>
      <div className="mt-5">{props.children}</div>
    </div>
  );
}

function WorkspaceModeBar(props: Readonly<{
  items: Array<{
    href: string;
    label: string;
    description: string;
    active: boolean;
  }>;
}>) {
  return (
    <div className="surface-panel flex flex-wrap gap-2 p-2.5">
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`min-w-[11rem] rounded-[1.15rem] border px-4 py-3 text-left transition ${
            item.active
              ? "border-accent/30 bg-accent/10"
              : "border-white/8 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.05]"
          }`}
        >
          <p className="text-sm font-medium text-copy">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
        </Link>
      ))}
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
      className={`block rounded-[1.7rem] border p-4 transition ${
        props.isSelected
          ? "surface-elevated border-accent/30"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] hover:border-white/12 hover:bg-white/[0.04]"
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

      <div className="mt-4 grid gap-3">
        <div className="surface-soft p-4">
          <p className="micro-label">Why this lead matters</p>
          <p className="mt-2 text-sm leading-6 text-copy">{row.workflowReason}</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="surface-soft p-4">
            <p className="micro-label">Offer focus</p>
            <p className="mt-2 text-sm leading-6 text-copy">{row.recommendedOffer}</p>
          </div>
          <div className="surface-soft p-4">
            <p className="micro-label">Review signal</p>
            <p className="mt-2 text-sm leading-6 text-copy">{row.latestReviewSummary}</p>
            <p className="mt-2 text-sm text-muted">{row.latestReviewMetaLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p className="min-w-0">{row.contactCoverage}</p>
        {row.recentReviews.length > 1 ? (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em]">
            +{row.recentReviews.length - 1} more review
            {row.recentReviews.length - 1 === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const rawSearchParams = await searchParams;
  const view = await getLeadsWorkspaceView(rawSearchParams);

  const workspaceModeParam = readSingleParam(rawSearchParams, "workspace");
  const workspaceMode: WorkspaceMode =
    workspaceModeParam === "queue" ? "queue" : "focus";

  const sectionParam = readSingleParam(rawSearchParams, "section");
  const profileSection: CompanyProfileSection =
    sectionParam === "website" ||
    sectionParam === "reviews" ||
    sectionParam === "contacts"
      ? sectionParam
      : "overview";

  const selectedCompanyId = view.selectedCompany?.companyId;
  const baseWorkspaceQuery: Record<string, string> = {
    ...view.query,
    ...(workspaceMode === "queue" ? { workspace: workspaceMode } : {}),
    ...(profileSection !== "overview" ? { section: profileSection } : {}),
  };
  const savedViewQuery = Object.fromEntries(
    Object.entries(baseWorkspaceQuery).filter(
      ([key]) => key !== "companyId" && key !== "workspace" && key !== "section",
    ),
  );
  const selectedLead = selectedCompanyId
    ? view.rows.find((row) => row.companyId === selectedCompanyId)
    : undefined;

  const queueItems = view.queueTabs.map((tab) => ({
    href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
      queue: tab.value === "all" ? null : tab.value,
    }),
    label: tab.label,
    count: tab.count,
    isActive: tab.active,
  }));

  const workspaceItems = [
    {
      href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
        workspace: "queue",
      }),
      label: "Queue mode",
      description: "Wider queue for fast triage and scanning",
      active: workspaceMode === "queue",
    },
    {
      href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
        workspace: null,
      }),
      label: "Focus mode",
      description: "Selected company gets the dominant reading width",
      active: workspaceMode === "focus",
    },
    {
      href: "/leads/enrichment",
      label: "Compare mode",
      description: "Use the enrichment workspace when you need side-by-side review",
      active: false,
    },
  ];

  const advancedFilterCount = ADVANCED_FILTER_KEYS.reduce((count, key) => {
    const value = view.filters.values[key];
    return value && value !== "all" ? count + 1 : count;
  }, 0);
  const showAdvancedFilters = advancedFilterCount > 0;

  const profileSectionLinks = selectedCompanyId
    ? [
        {
          label: "Overview",
          href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
            companyId: selectedCompanyId,
            section: null,
          }),
          active: profileSection === "overview",
        },
        {
          label: "Website",
          href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
            companyId: selectedCompanyId,
            section: "website",
          }),
          active: profileSection === "website",
        },
        {
          label: "Reviews",
          href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
            companyId: selectedCompanyId,
            section: "reviews",
          }),
          active: profileSection === "reviews",
        },
        {
          label: "Contacts",
          href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
            companyId: selectedCompanyId,
            section: "contacts",
          }),
          active: profileSection === "contacts",
        },
      ]
    : undefined;

  const clearFiltersHref = buildPathWithQuery("/leads", {
    ...(workspaceMode === "queue" ? { workspace: workspaceMode } : {}),
    ...(profileSection !== "overview" ? { section: profileSection } : {}),
    ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
  });

  const queueColumnClass =
    workspaceMode === "queue"
      ? "xl:min-h-[calc(100vh-18rem)] xl:max-h-[calc(100vh-18rem)]"
      : "xl:min-h-[calc(100vh-18rem)] xl:max-h-[calc(100vh-18rem)]";
  const workspaceGridClass =
    workspaceMode === "queue"
      ? "grid gap-6 xl:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)]"
      : "grid gap-6 xl:grid-cols-[minmax(22rem,25rem)_minmax(0,1fr)]";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Intake"
        title="Prospect intake and review workspace"
        description="Treat the leads page like an operator console: shape the queue quickly, scan a wider list comfortably, and give the selected company the reading width it needs."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/leads/intake" className="button-success">
              Create or import leads
            </Link>
            <Link href="/leads/enrichment" className="button-warning">
              Run enrichment
            </Link>
            <Link href="/companies" className="button-primary">
              Open company intelligence
            </Link>
            {view.hasActiveFilters ? (
              <Link href={clearFiltersHref} className="button-secondary">
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
        <SegmentedControl items={queueItems} />
        <WorkspaceModeBar items={workspaceItems} />
      </div>

      <SavedWorkspaceViewsBar
        path="/leads"
        currentQuery={savedViewQuery}
        presets={getLeadWorkspaceViewPresets()}
      />

      <FilterPanel
        title="Queue controls"
        description="Keep the everyday triage controls visible, and tuck deeper filters into an advanced drawer instead of a giant always-open form."
        bodyClassName="space-y-4"
      >
        <form className="space-y-4">
          <input
            type="hidden"
            name="queue"
            value={view.filters.values.queue === "all" ? "" : view.filters.values.queue}
          />
          <input type="hidden" name="companyId" value={selectedCompanyId ?? ""} />
          <input
            type="hidden"
            name="workspace"
            value={workspaceMode === "focus" ? "" : workspaceMode}
          />
          <input
            type="hidden"
            name="section"
            value={profileSection === "overview" ? "" : profileSection}
          />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_repeat(4,minmax(10.5rem,0.78fr))_auto]">
            <label className="space-y-2">
              <span className="micro-label">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={view.filters.values.q}
                placeholder="Search company, market, source, website, or contact"
                className="field-shell"
              />
            </label>
            <label className="space-y-2">
              <span className="micro-label">Review signal</span>
              <select
                name="review"
                defaultValue={view.filters.values.review}
                className="field-shell"
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
                className="field-shell"
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
                name="contactPath"
                defaultValue={view.filters.values.contactPath}
                className="field-shell"
              >
                {view.filters.contactPathOptions.map((option) => (
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
                className="field-shell"
              >
                {view.filters.sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-3 xl:justify-end">
              <button
                type="submit"
                className="rounded-[1.15rem] border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
              >
                Apply
              </button>
              {view.hasActiveFilters ? (
                <Link
                  href={clearFiltersHref}
                  className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </div>

          <details open={showAdvancedFilters} className="group">
            <summary className="surface-muted flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="micro-label">Advanced filters</p>
                <p className="mt-2 text-sm text-muted">
                  {advancedFilterCount > 0
                    ? `${advancedFilterCount} advanced filter${advancedFilterCount === 1 ? "" : "s"} active`
                    : "Geography, readiness, and deeper contact/discovery filters"}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted">
                {showAdvancedFilters ? "Open" : "Closed"}
              </span>
            </summary>
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <FilterGroup
                title="Fit and readiness"
                description="Use these when the queue needs to shrink around the operators' real near-term work."
              >
                <div className="grid gap-4">
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
                  <label className="space-y-2">
                    <span className="micro-label">Enrichment</span>
                    <select
                      name="enrichment"
                      defaultValue={view.filters.values.enrichment}
                      className="field-shell"
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
                      className="field-shell"
                    >
                      {view.filters.statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </FilterGroup>

              <FilterGroup
                title="Timing and geography"
                description="These are useful when the queue needs to match the exact import window or market you want to work."
              >
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="micro-label">Imported</span>
                    <select
                      name="imported"
                      defaultValue={view.filters.values.imported}
                      className="field-shell"
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
                      className="field-shell"
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
                      className="field-shell"
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
                      className="field-shell"
                    >
                      {view.filters.cityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </FilterGroup>

              <FilterGroup
                title="Discovery and contact detail"
                description="Use these when you're working narrower workflow states like website review, named-contact quality, or confidence cleanup."
              >
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="micro-label">Website review</span>
                    <select
                      name="websiteReview"
                      defaultValue={view.filters.values.websiteReview}
                      className="field-shell"
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
                      className="field-shell"
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
                      className="field-shell"
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
                      className="field-shell"
                    >
                      {view.filters.confidenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </FilterGroup>
            </div>
          </details>
        </form>
      </FilterPanel>

      <div className={workspaceGridClass}>
        <SectionCard
          title="Lead queue"
          description={`${view.resultLabel}. Choose a lead to promote it into the main review profile.`}
          className={queueColumnClass}
        >
          {view.rows.length > 0 ? (
            <div className="scrollbar-subtle space-y-3 xl:h-[calc(100vh-25rem)] xl:overflow-y-auto xl:pr-1">
              {view.rows.map((row) => (
                <LeadQueueListItem
                  key={row.companyId}
                  row={row}
                  href={buildPathWithQuery("/leads", baseWorkspaceQuery, {
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

        <div className={workspaceMode === "focus" ? "grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(19rem,21rem)]" : "space-y-6"}>
          <SelectedCompanyProfile
            company={view.selectedCompany}
            section={profileSection}
            sectionLinks={profileSectionLinks}
          />

          {view.selectedCompany && selectedLead ? (
            <div className="space-y-4">
              <SectionCard
                title="Action rail"
                description="Keep only the next decisions close at hand. Deeper evidence lives in the main profile so the right side stays calm."
              >
                <div className="space-y-4">
                  <div className="surface-muted p-5">
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
                    <p className="mt-3 text-base font-medium text-copy">
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

                  <div className="surface-muted p-5">
                    <p className="micro-label">Website review</p>
                    <p className="mt-3 break-words text-sm text-copy">
                      {selectedLead.websiteLabel}
                    </p>
                    <p className="mt-2 break-words text-sm text-muted">
                      {selectedLead.websiteDiscoverySource} •{" "}
                      {selectedLead.websiteDiscoveryReason}
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

                  <details className="surface-muted p-5">
                    <summary className="cursor-pointer list-none">
                      <p className="micro-label">Diagnostics</p>
                      <p className="mt-2 text-sm text-muted">
                        Provider evidence and scoring details stay available without competing with the main decision flow.
                      </p>
                    </summary>
                    <div className="mt-4 space-y-4">
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
                      <ProviderRunSummary
                        badge={selectedLead.providerBadge}
                        label={selectedLead.providerLabel}
                        fallback={selectedLead.providerFallbackLabel}
                        evidence={selectedLead.providerEvidence}
                        pageUsage={selectedLead.supportingPageUsage}
                      />
                    </div>
                  </details>
                </div>
              </SectionCard>

              <CampaignEnrollmentPanel
                title="Campaign assignment"
                description="Assign or enroll the selected lead from a calmer action lane that supports the main profile instead of competing with it."
                panel={view.selectedCompany.campaignAssignment}
                autoSelectSingle
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
