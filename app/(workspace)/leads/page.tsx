import Link from "next/link";
import type { ReactNode } from "react";
import {
  CompanyProfileSection,
  SelectedCompanyProfile,
} from "@/components/companies/selected-company-profile";
import { CampaignEnrollmentPanel } from "@/components/leads/campaign-enrollment-panel";
import { SavedWorkspaceViewsBar } from "@/components/leads/saved-workspace-views-bar";
import { WebsiteDiscoveryReviewActions } from "@/components/leads/website-discovery-review-actions";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
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
  "source",
  "websiteReview",
  "contact",
  "primary",
  "confidence",
] as const;

const pulseToneClasses = {
  neutral: "border-accent/20 bg-accent/10 text-copy",
  positive: "border-success/20 bg-success/10 text-copy",
  warning: "border-warning/20 bg-warning/10 text-copy",
} as const;

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function FilterSection(props: Readonly<{
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

function WorkspacePulse(props: Readonly<{
  label: string;
  value: string;
  detail?: string;
  change?: string;
  tone: "neutral" | "positive" | "warning";
}>) {
  return (
    <div className="surface-soft p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="micro-label">{props.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-copy">
            {props.value}
          </p>
        </div>
        {props.change ? (
          <span
            className={`rounded-full border px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] ${pulseToneClasses[props.tone]}`}
          >
            {props.change}
          </span>
        ) : null}
      </div>
      {props.detail ? (
        <p className="mt-3 text-sm leading-6 text-muted">{props.detail}</p>
      ) : null}
    </div>
  );
}

function WorkspaceModeToggle(props: Readonly<{
  items: Array<{
    href: string;
    label: string;
    active: boolean;
  }>;
}>) {
  return (
    <div className="space-y-2">
      <p className="micro-label">Layout</p>
      <div className="flex flex-wrap gap-2">
        {props.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              item.active
                ? "border-accent/30 bg-accent/10 text-copy"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-white/14 hover:bg-white/[0.06] hover:text-copy"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function QueueTabs(props: Readonly<{
  items: Array<{
    href: string;
    label: string;
    count: number;
    isActive: boolean;
  }>;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
            item.isActive
              ? "border-accent/30 bg-accent/10 text-copy"
              : "border-white/10 bg-white/[0.03] text-muted hover:border-white/14 hover:bg-white/[0.06] hover:text-copy"
          }`}
        >
          <span>{item.label}</span>
          <span
            className={`rounded-full px-2 py-1 text-[0.66rem] uppercase tracking-[0.16em] ${
              item.isActive ? "bg-accent/15 text-copy" : "bg-white/[0.05] text-muted"
            }`}
          >
            {item.count}
          </span>
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
      aria-current={props.isSelected ? "page" : undefined}
      className={`block rounded-[1.5rem] border px-4 py-4 transition ${
        props.isSelected
          ? "surface-elevated border-accent/30"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] hover:border-white/12 hover:bg-white/[0.045]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-[0.98rem] font-medium tracking-[-0.01em] text-copy">
              {row.companyName}
            </p>
            <StatusBadge label={row.queueBadge.label} tone={row.queueBadge.tone} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {row.market} • {row.subindustry}
          </p>
        </div>

        <div className="hidden flex-wrap justify-end gap-2 md:flex">
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
      </div>

      <p className="mt-3 text-sm leading-6 text-copy">{row.workflowReason}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span>{row.contactCoverage}</span>
        <span>{row.recommendedOffer}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.importedLabel}
        </p>
        <div className="flex flex-wrap gap-2 md:hidden">
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
      </div>
    </Link>
  );
}

function RailCard(props: Readonly<{
  label: string;
  title?: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="panel-header-quiet px-5 py-4">
        <p className="micro-label">{props.label}</p>
        {props.title ? (
          <p className="mt-2 text-sm font-medium text-copy">{props.title}</p>
        ) : null}
        {props.description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{props.description}</p>
        ) : null}
      </div>
      <div className="px-5 py-5">{props.children}</div>
    </section>
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
        workspace: null,
      }),
      label: "Operator focus",
      active: workspaceMode === "focus",
    },
    {
      href: buildPathWithQuery("/leads", baseWorkspaceQuery, {
        workspace: "queue",
      }),
      label: "Queue scan",
      active: workspaceMode === "queue",
    },
  ];

  const advancedFilterCount = ADVANCED_FILTER_KEYS.reduce((count, key) => {
    const value = view.filters.values[key];
    return value && value !== "all" ? count + 1 : count;
  }, 0);
  const activeFilterCount = Object.keys(savedViewQuery).length;
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

  const workspaceGridClass =
    workspaceMode === "queue"
      ? "grid gap-6 xl:grid-cols-[minmax(22rem,24rem)_minmax(0,1fr)_minmax(17rem,18.5rem)]"
      : "grid gap-6 xl:grid-cols-[minmax(20rem,21.5rem)_minmax(0,1fr)_minmax(17rem,18.5rem)]";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Workspace"
        title="Operator-first lead console"
        description="Keep the queue light, promote one company into a wider reading workspace, and hold only the next-step actions on the rail so the page feels fast instead of crowded."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/leads/intake" className="button-success">
              Create or import leads
            </Link>
            <Link href="/leads/enrichment" className="button-warning">
              Compare enrichment
            </Link>
            <Link
              href={selectedCompanyId ? `/companies?companyId=${selectedCompanyId}` : "/companies"}
              className="button-secondary"
            >
              Open company intelligence
            </Link>
          </div>
        }
      />

      <section className="surface-panel overflow-hidden">
        <div className="panel-header px-6 py-6 lg:px-7 lg:py-7">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="micro-label">Top control bar</p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted">
                  {view.resultLabel}
                </span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-copy">
                    {activeFilterCount} active filter
                    {activeFilterCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted">
                Compact queue controls stay visible by default. Saved views and
                deeper filters stay close, but the reading-heavy detail now lives in
                the selected company workspace instead of inside every queue row.
              </p>
              <SavedWorkspaceViewsBar
                path="/leads"
                currentQuery={savedViewQuery}
                presets={getLeadWorkspaceViewPresets()}
              />
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <WorkspaceModeToggle items={workspaceItems} />
              {view.hasActiveFilters ? (
                <div className="space-y-2">
                  <p className="micro-label">Reset</p>
                  <Link href={clearFiltersHref} className="button-secondary">
                    Clear filters
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {view.stats.map((stat) => (
              <WorkspacePulse
                key={stat.label}
                label={stat.label}
                value={stat.value}
                detail={stat.detail}
                change={stat.change}
                tone={stat.tone ?? "neutral"}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-6 lg:px-7 lg:py-7">
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

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(9.75rem,0.82fr))_auto]">
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
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.025] px-5 py-4 transition hover:border-white/14 hover:bg-white/[0.04]">
                <div>
                  <p className="micro-label">Advanced filters</p>
                  <p className="mt-2 text-sm text-muted">
                    {advancedFilterCount > 0
                      ? `${advancedFilterCount} advanced filter${advancedFilterCount === 1 ? "" : "s"} active`
                      : "Reveal deeper fit, timing, geography, and diagnostic controls only when you need them."}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted">
                  {showAdvancedFilters ? "Open" : "Closed"}
                </span>
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <FilterSection
                  title="Fit and readiness"
                  description="Use these when the queue needs to narrow around the work that is truly ready for operator attention."
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
                </FilterSection>

                <FilterSection
                  title="Timing and geography"
                  description="Bring the queue down to the exact import window, market, or source slice you want to work right now."
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
                    <label className="space-y-2">
                      <span className="micro-label">Source</span>
                      <select
                        name="source"
                        defaultValue={view.filters.values.source}
                        className="field-shell"
                      >
                        {view.filters.sourceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({option.count})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </FilterSection>

                <FilterSection
                  title="Discovery and contact detail"
                  description="Use these when you are cleaning up workflow edges like website review, contact coverage, or primary-path quality."
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
                  </div>
                </FilterSection>
              </div>
            </details>
          </form>
        </div>
      </section>

      <div className={workspaceGridClass}>
        <SectionCard
          title="Lead queue"
          description={`${view.resultLabel}. Queue rows stay brief so the selected company can carry the deeper context.`}
          className="self-start xl:sticky xl:top-6"
          contentClassName="space-y-4"
        >
          <QueueTabs items={queueItems} />

          {view.rows.length > 0 ? (
            <div className="scrollbar-subtle space-y-3 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto xl:pr-1">
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

        <SelectedCompanyProfile
          company={view.selectedCompany}
          section={profileSection}
          sectionLinks={profileSectionLinks}
        />

        <div className="space-y-4 self-start xl:sticky xl:top-6">
          {view.selectedCompany && selectedLead ? (
            <>
              <RailCard
                label="Next step"
                title={selectedLead.recommendedCampaignName}
                description="Keep only the immediate routing decision and the minimum supporting context here."
              >
                <div className="space-y-4">
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

                  <p className="text-sm leading-7 text-copy">{selectedLead.nextAction}</p>

                  <div className="surface-soft p-4">
                    <p className="micro-label">Routing reason</p>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {selectedLead.assignmentDecisionReason}
                    </p>
                  </div>

                  <p className="text-sm leading-6 text-muted">
                    {selectedLead.missingFieldsLabel}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/companies?companyId=${selectedLead.companyId}`}
                      className="button-secondary"
                    >
                      Open company
                    </Link>
                    <Link href="/campaigns" className="button-secondary">
                      Campaigns
                    </Link>
                  </div>
                </div>
              </RailCard>

              <RailCard
                label="Website review"
                title={selectedLead.websiteLabel}
                description={`${selectedLead.websiteDiscoverySource} • ${selectedLead.websiteDiscoveryReason}`}
              >
                <WebsiteDiscoveryReviewActions
                  companyId={selectedLead.companyId}
                  candidateWebsite={
                    selectedLead.canReviewWebsiteCandidate
                      ? selectedLead.candidateWebsite
                      : undefined
                  }
                  officialWebsite={selectedLead.officialWebsite}
                />
              </RailCard>

              <CampaignEnrollmentPanel
                title="Campaign routing"
                description="Assign or enroll from a compact action lane that stays secondary to the main reading workspace."
                panel={view.selectedCompany.campaignAssignment}
                autoSelectSingle
                compact
              />

              <details className="surface-panel overflow-hidden">
                <summary className="panel-header-quiet cursor-pointer list-none px-5 py-4">
                  <p className="micro-label">Diagnostics</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Provider evidence stays available without competing with the
                    main workspace.
                  </p>
                </summary>
                <div className="px-5 py-5">
                  <ProviderRunSummary
                    badge={selectedLead.providerBadge}
                    label={selectedLead.providerLabel}
                    fallback={selectedLead.providerFallbackLabel}
                    evidence={selectedLead.providerEvidence}
                    pageUsage={selectedLead.supportingPageUsage}
                  />
                </div>
              </details>
            </>
          ) : (
            <RailCard
              label="Action rail"
              title="Select a company"
              description="Next-step actions stay quiet until a company is promoted out of the queue."
            >
              <p className="text-sm leading-6 text-muted">
                Choose a lead from the queue to unlock website review, campaign
                routing, and compact diagnostics.
              </p>
            </RailCard>
          )}
        </div>
      </div>
    </div>
  );
}
