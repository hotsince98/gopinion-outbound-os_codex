import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getDashboardView } from "@/lib/data/selectors/dashboard";

export const metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = await getDashboardView();

  const priorityRows = dashboard.priorityLeads.map((lead) => ({
    id: lead.companyId,
    cells: [
      <div key={`${lead.companyId}-company`} className="space-y-1">
        <Link
          href={`/leads?companyId=${lead.companyId}`}
          className="font-medium text-copy transition hover:text-accent"
        >
          {lead.companyName}
        </Link>
        <p className="text-sm text-muted">{lead.market}</p>
      </div>,
      <span key={`${lead.companyId}-offer`} className="text-sm text-copy">
        {lead.offerName}
      </span>,
      <div key={`${lead.companyId}-owner`} className="space-y-1">
        <p className="text-sm text-copy">{lead.decisionMakerLabel}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {lead.confidenceLabel}
        </p>
      </div>,
      <span key={`${lead.companyId}-next`} className="text-sm text-muted">
        {lead.nextStep}
      </span>,
    ],
  }));

  const sequenceRows = dashboard.sequenceHealth.map((sequence) => ({
    id: sequence.sequenceId,
    cells: [
      <div key={`${sequence.sequenceId}-name`} className="space-y-1">
        <p className="font-medium text-copy">{sequence.name}</p>
        <p className="text-sm text-muted">{sequence.segment}</p>
      </div>,
      <span key={`${sequence.sequenceId}-enrolled`} className="text-sm text-copy">
        {sequence.enrolledCount}
      </span>,
      <span key={`${sequence.sequenceId}-reply`} className="text-sm text-copy">
        {sequence.replyRate}
      </span>,
      <span key={`${sequence.sequenceId}-booked`} className="text-sm text-copy">
        {sequence.bookedCount}
      </span>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations Dashboard"
        title="Outbound command deck"
        description="Stay summary-first here: scan the queue, review pressure, campaign health, and blockers without turning the dashboard into a second workspace."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/leads" className="button-primary">
              Open leads workspace
            </Link>
            <Link href="/campaigns" className="button-secondary">
              Review campaigns
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.stats.map((stat) => (
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.95fr)]">
        <SectionCard
          title="Priority queue snapshot"
          description="The highest-signal accounts that deserve operator attention first."
        >
          <TableShell
            columns={["Company", "Offer", "Decision-maker hypothesis", "Next step"]}
            rows={priorityRows}
            emptyTitle="No priority companies yet"
            emptyDescription="The current backend has no qualified or campaign-ready companies. Seed the supported Postgres tables or switch back to mock mode if you want demo data."
          />
        </SectionCard>

        <SectionCard
          title="Review watchlist"
          description="Fresh public-review pressure worth acting on before it cools off."
        >
          {dashboard.reviewWatchlist.length > 0 ? (
            <div className="space-y-3">
              {dashboard.reviewWatchlist.map((review) => (
                <Link
                  key={review.companyId}
                  href={`/leads?companyId=${review.companyId}&section=reviews`}
                  className="surface-muted block p-4 transition hover:border-white/12 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-copy">{review.companyName}</p>
                      <p className="mt-1 text-sm text-muted">{review.market}</p>
                    </div>
                    <StatusBadge label={review.badge.label} tone={review.badge.tone} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-copy">{review.summary}</p>
                  <p className="mt-2 text-sm text-muted">{review.metaLabel}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Review watch"
              title="No review watchlist items yet"
              description="Imported latest-review context will surface here as soon as it can help with urgency and prioritization."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.95fr)]">
        <SectionCard
          title="Sequence health"
          description="A quick read on outbound throughput without leaving the command deck."
        >
          <TableShell
            columns={["Sequence", "Enrolled", "Reply rate", "Booked"]}
            rows={sequenceRows}
            emptyTitle="No sequence activity yet"
            emptyDescription="No active sequence health records are available for the current backend snapshot."
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Learning signals"
            description="Repeatable lessons and notable patterns for the team."
          >
            {dashboard.learningSignals.length > 0 ? (
              <div className="space-y-3">
                {dashboard.learningSignals.map((signal) => (
                  <div key={signal.id} className="surface-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-copy">{signal.title}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted">
                        {signal.tag}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {signal.summary}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="Learning"
                title="No learning signals yet"
                description="As replies, appointments, and ops notes accumulate, the most reusable lessons will surface here."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Blockers"
            description="Operational friction points that still need a workflow or data fix."
          >
            {dashboard.blockers.length > 0 ? (
              <div className="space-y-3">
                {dashboard.blockers.map((blocker) => (
                  <div key={blocker.id} className="surface-muted p-4">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                      <p className="text-sm font-medium text-copy">{blocker.title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {blocker.summary}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="Blockers"
                title="No active blockers recorded"
                description="The current snapshot has no stored blocker notes to surface here."
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
