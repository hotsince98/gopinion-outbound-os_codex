import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { GraphNodeCard } from "@/components/ui/graph-node-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getGraphWorkspaceView } from "@/lib/data/selectors/graph";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Graph",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GraphPage({ searchParams }: PageProps) {
  const view = await getGraphWorkspaceView(await searchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Graph Command Center"
        title="Relationship-aware outbound command center"
        description="Inspect how typed companies, contacts, campaigns, offers, appointments, and insights connect across the outbound system. The graph stays useful by emphasizing relationships and next actions instead of visual gimmicks."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="button-primary">
              Back to dashboard
            </Link>
            {view.hasActiveFilters ? (
              <Link href="/graph" className="button-secondary">
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

      <FilterPanel
        title="Graph controls"
        description="Shape the graph with the same calm filter language as the rest of the product. Keep relationships visible without turning the canvas into noise."
      >
        <form className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_repeat(2,minmax(0,1fr))_auto] lg:items-end">
            <label className="space-y-2">
              <span className="micro-label">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={view.filters.values.q}
                placeholder="Search company, campaign, offer, or related node"
                className="field-shell"
              />
            </label>

            <label className="space-y-2">
              <span className="micro-label">Node type</span>
              <select
                name="nodeType"
                defaultValue={view.filters.values.nodeType}
                className="field-shell"
              >
                {view.filters.nodeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="micro-label">Status / state</span>
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

            <button type="submit" className="button-primary">
              Apply filters
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {view.filters.relationshipToggles.map((toggle) => (
              <label
                key={toggle.key}
                className="surface-soft flex items-center gap-3 px-4 py-3 text-sm text-copy"
              >
                <input
                  type="checkbox"
                  name={toggle.key}
                  value="1"
                  defaultChecked={toggle.enabled}
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-[rgb(var(--accent))]"
                />
                <span>{toggle.label}</span>
                <span className="text-muted">({toggle.count})</span>
              </label>
            ))}
          </div>
        </form>
      </FilterPanel>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Structured node canvas"
          description={`${view.resultLabel}. Select a node to inspect its connected records and operational next action.`}
        >
          {view.groups.some((group) => group.count > 0) ? (
            <div className="space-y-5">
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[980px] gap-4 lg:grid-cols-2 2xl:min-w-0 2xl:grid-cols-3">
                  {view.groups.map((group) => (
                    <div key={group.type} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="micro-label">{group.label}</p>
                          <p className="mt-2 text-sm text-muted">
                            {group.count} visible
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.nodes.map((node) => (
                          <GraphNodeCard
                            key={node.id}
                            href={buildPathWithQuery("/graph", view.query, {
                              nodeId: node.id,
                            })}
                            title={node.title}
                            subtitle={node.subtitle}
                            statusBadge={node.statusBadge}
                            metrics={node.metrics}
                            relationCount={node.relationCount ?? 0}
                            active={view.selectedNode?.id === node.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-muted p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-copy">Visible relationships</p>
                  <p className="text-sm text-muted">
                    {view.relationships.length} shown
                  </p>
                </div>

                {view.relationships.length > 0 ? (
                  <div className="space-y-3">
                    {view.relationships.map((relationship) => (
                      <div
                        key={relationship.id}
                        className="surface-soft p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            label={relationship.label}
                            tone="muted"
                          />
                          <p className="text-sm font-medium text-copy">
                            {relationship.sourceTitle}
                          </p>
                          <span className="text-sm text-muted">→</span>
                          <p className="text-sm font-medium text-copy">
                            {relationship.targetTitle}
                          </p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted">
                          {relationship.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    eyebrow="Relationships"
                    title="No visible relationships"
                    description="Turn on more relationship classes or widen the node filters to show how the current records connect."
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="Graph canvas"
              title={view.emptyState.title}
              description={view.emptyState.description}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Node inspector"
          description="The selected node shows status, typed relationships, and the best operational next step."
        >
          {view.selectedNode ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={view.selectedNode.statusBadge.label}
                    tone={view.selectedNode.statusBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedNode.type}
                    tone="muted"
                  />
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-copy">
                  {view.selectedNode.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {view.selectedNode.subtitle}
                </p>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Recommended next action</p>
                <p className="mt-3 text-sm leading-6 text-copy">
                  {view.selectedNode.nextAction}
                </p>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Basics</p>
                <div className="mt-3 space-y-3">
                  {view.selectedNode.basics.map((item) => (
                    <div key={item.label}>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-copy">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Related records</p>
                <div className="mt-3 space-y-3">
                  {view.selectedNode.relatedRecords.map((item) => (
                    <div key={item.label}>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-copy">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Notes</p>
                <div className="mt-3 space-y-2">
                  {view.selectedNode.notes.map((note) => (
                    <p key={note} className="text-sm leading-6 text-muted">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="Inspector"
              title="No node selected"
              description="Adjust the graph filters or select a visible node to inspect its related records."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
