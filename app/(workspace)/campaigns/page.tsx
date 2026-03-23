import Link from "next/link";
import { SequenceSummary } from "@/components/campaigns/sequence-summary";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getCampaignsWorkspaceView } from "@/lib/data/selectors/campaigns";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Campaigns",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignsPage({ searchParams }: PageProps) {
  const view = await getCampaignsWorkspaceView(await searchParams);

  const rows = view.rows.map((row) => ({
    id: row.campaignId,
    cells: [
      <div key={`${row.campaignId}-campaign`} className="space-y-2">
        <Link
          href={buildPathWithQuery("/campaigns", view.query, {
            campaignId: row.campaignId,
          })}
          className="font-medium text-copy transition hover:text-accent"
        >
          {row.campaignName}
        </Link>
        <p className="text-sm leading-6 text-muted">{row.description}</p>
      </div>,
      <span key={`${row.campaignId}-icp`} className="text-sm text-copy">
        {row.icpLabel}
      </span>,
      <span key={`${row.campaignId}-offer`} className="text-sm text-copy">
        {row.offerName}
      </span>,
      <span key={`${row.campaignId}-channel`} className="text-sm text-copy">
        {row.channelLabel}
      </span>,
      <div key={`${row.campaignId}-status`} className="space-y-2">
        <StatusBadge
          label={row.statusBadge.label}
          tone={row.statusBadge.tone}
        />
        <StatusBadge
          label={row.healthBadge.label}
          tone={row.healthBadge.tone}
        />
      </div>,
      <span key={`${row.campaignId}-sequence`} className="text-sm text-copy">
        {row.sequenceVersionLabel}
      </span>,
      <span key={`${row.campaignId}-enrollments`} className="text-sm text-copy">
        {row.enrollmentsLabel}
      </span>,
      <span key={`${row.campaignId}-replies`} className="text-sm text-copy">
        {row.repliesLabel}
      </span>,
      <span key={`${row.campaignId}-appointments`} className="text-sm text-copy">
        {row.bookedAppointmentsLabel}
      </span>,
      <div key={`${row.campaignId}-next-action`} className="space-y-2">
        <p className="text-sm leading-6 text-copy">{row.nextAction}</p>
        {row.nextActionAtLabel ? (
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Next touch: {row.nextActionAtLabel}
          </p>
        ) : null}
      </div>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaign workspace and sequence operations"
        description="Manage live and draft outbound campaigns from typed campaign, sequence, enrollment, reply, and appointment records. The workspace stays operational without pushing campaign logic into the page."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/companies?readiness=ready"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Ready accounts
            </Link>
            <Link
              href="/campaigns?status=draft"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Review drafts
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/campaigns"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
        <form className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <input
            type="hidden"
            name="campaignId"
            value={view.filters.values.campaignId}
          />

          <label className="space-y-2">
            <span className="micro-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={view.filters.values.q}
              placeholder="Search campaign, offer, ICP, or objective"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
            />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Campaign status</span>
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
            <span className="micro-label">Offer</span>
            <select
              name="offer"
              defaultValue={view.filters.values.offer}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.offerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="micro-label">ICP</span>
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
            <span className="micro-label">Channel</span>
            <select
              name="channel"
              defaultValue={view.filters.values.channel}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.channelOptions.map((option) => (
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

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Campaign management queue"
          description={`${view.resultLabel}. Select a campaign to inspect targeting, sequence versions, enrollment health, and reply pressure.`}
        >
          <TableShell
            columns={[
              "Campaign",
              "ICP",
              "Offer",
              "Channel",
              "Status",
              "Sequence version",
              "Enrollments",
              "Replies",
              "Booked appointments",
              "Next action",
            ]}
            rows={rows}
            emptyTitle={view.emptyState.title}
            emptyDescription={view.emptyState.description}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Selected campaign"
            description="A typed detail view for the current campaign, including execution metrics and suggested next actions."
          >
            {view.selectedCampaign ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {view.selectedCampaign.statusBadges.map((badge) => (
                      <StatusBadge
                        key={`${view.selectedCampaign?.campaignId}-${badge.label}`}
                        label={badge.label}
                        tone={badge.tone}
                      />
                    ))}
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-copy">
                      {view.selectedCampaign.campaignName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {view.selectedCampaign.description}
                    </p>
                  </div>

                  <div className="surface-muted p-4">
                    <p className="micro-label">Objective</p>
                    <p className="mt-3 text-sm leading-6 text-copy">
                      {view.selectedCampaign.objective}
                    </p>
                  </div>

                  <div className="surface-muted p-4">
                    <p className="micro-label">Suggested next action</p>
                    <p className="mt-3 text-sm leading-6 text-copy">
                      {view.selectedCampaign.suggestedNextAction}
                    </p>
                  </div>
                </div>

                <DetailList items={view.selectedCampaign.basics} />
                <DetailList items={view.selectedCampaign.targeting} />

                <div className="space-y-3">
                  <p className="micro-label">Enrollment summary</p>
                  <DetailList items={view.selectedCampaign.enrollmentSummary} />
                </div>

                <div className="space-y-3">
                  <p className="micro-label">Reply summary</p>
                  <DetailList items={view.selectedCampaign.replySummary} />
                </div>

                <div className="space-y-3">
                  <p className="micro-label">Appointment attribution</p>
                  <DetailList items={view.selectedCampaign.appointmentSummary} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="surface-muted p-4">
                    <p className="micro-label">Readiness notes</p>
                    <div className="mt-3 space-y-3">
                      {view.selectedCampaign.readinessNotes.length > 0 ? (
                        view.selectedCampaign.readinessNotes.map((note) => (
                          <p key={note} className="text-sm leading-6 text-muted">
                            {note}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted">
                          No additional readiness notes right now.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="surface-muted p-4">
                    <p className="micro-label">Experiment notes</p>
                    <div className="mt-3 space-y-3">
                      {view.selectedCampaign.experimentNotes.length > 0 ? (
                        view.selectedCampaign.experimentNotes.map((note) => (
                          <p key={note} className="text-sm leading-6 text-muted">
                            {note}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted">
                          No experiment notes linked yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Recent replies</p>
                  <div className="mt-3 space-y-4">
                    {view.selectedCampaign.recentReplies.length > 0 ? (
                      view.selectedCampaign.recentReplies.map((reply) => (
                        <article key={reply.id} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              label={reply.classificationBadge.label}
                              tone={reply.classificationBadge.tone}
                            />
                            <p className="text-sm font-medium text-copy">
                              {reply.companyName} • {reply.contactName}
                            </p>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted">
                              {reply.receivedAtLabel}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-muted">
                            {reply.snippet}
                          </p>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        No replies have landed for this campaign yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                eyebrow="Campaign"
                title="No campaign selected"
                description="Pick a campaign from the table to inspect its execution detail."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Sequence summary"
            description="Current sequence steps and version history tied directly to the selected campaign."
          >
            {view.selectedCampaign?.linkedSequence ? (
              <SequenceSummary summary={view.selectedCampaign.linkedSequence} />
            ) : (
              <EmptyState
                eyebrow="Sequence"
                title="No linked sequence"
                description="This campaign does not have a typed sequence attached yet."
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
