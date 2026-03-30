import Link from "next/link";
import { RecentReviewList } from "@/components/reviews/recent-review-list";
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
        title="Operator command deck"
        description="Scan the most important queue, campaign, and blocker signals first so the next human action is obvious without digging through the full workspace."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="button-primary"
            >
              Review campaigns
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Priority dealer queue"
          description="The highest-signal accounts to review first, combining fit, contact readiness, and fresh review pressure."
        >
          {dashboard.priorityLeads.length > 0 ? (
            <div className="space-y-4">
              {dashboard.priorityLeads.map((lead) => (
                <div key={lead.companyId} className="surface-elevated p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-copy">{lead.companyName}</p>
                      <p className="mt-1 text-sm text-muted">{lead.market}</p>
                    </div>
                    <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-copy">
                      {lead.confidenceLabel}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <div className="surface-soft p-4">
                      <p className="micro-label">Offer focus</p>
                      <p className="mt-2 text-sm leading-6 text-copy">{lead.offerName}</p>
                      <p className="mt-2 text-sm text-muted">{lead.decisionMakerLabel}</p>
                    </div>
                    <div className="surface-soft p-4">
                      <p className="micro-label">Next operator move</p>
                      <p className="mt-2 text-sm leading-6 text-copy">{lead.nextStep}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Priority queue"
              title="No priority companies yet"
              description="The current backend has no qualified or campaign-ready companies. Seed the supported Postgres tables or switch back to mock mode if you want demo data."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Review watchlist"
          description="Fresh public-review context worth acting on before it cools off."
        >
          {dashboard.reviewWatchlist.length > 0 ? (
            <div className="grid gap-3">
              {dashboard.reviewWatchlist.map((review) => (
                <div
                  key={review.companyId}
                  className="surface-muted p-5 transition hover:border-white/12 hover:bg-white/[0.05]"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-copy">{review.companyName}</p>
                    <StatusBadge
                      label={review.badge.label}
                      tone={review.badge.tone}
                    />
                  </div>
                  <p className="text-sm text-muted">{review.market}</p>
                  <div className="surface-soft mt-4 p-4">
                    <p className="text-sm leading-6 text-copy">{review.summary}</p>
                    <p className="mt-2 text-sm text-muted">{review.metaLabel}</p>
                  </div>
                  <div className="mt-4">
                    <RecentReviewList
                      items={review.recentReviews}
                      maxItems={2}
                      compact
                      emptyMessage="No recent review snippets are attached on this company yet."
                    />
                  </div>
                </div>
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

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Sequence health"
          description="Email-first outbound performance placeholders to shape the first analytics views."
        >
          <TableShell
            columns={["Sequence", "Enrolled", "Reply rate", "Booked"]}
            rows={sequenceRows}
            emptyTitle="No sequence activity yet"
            emptyDescription="No active sequence health records are available for the current backend snapshot."
          />
        </SectionCard>

        <SectionCard
          title="Learning and blockers"
          description="Operational friction points and repeatable lessons to keep the operator loop improving."
        >
          <div className="space-y-4">
            {dashboard.learningSignals.length > 0 ? (
              <div className="space-y-3">
                {dashboard.learningSignals.map((signal) => (
                  <div key={signal.id} className="surface-soft p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-copy">{signal.title}</p>
                      <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
                        {signal.tag}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted">{signal.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {dashboard.blockers.length > 0 ? (
              <div className="space-y-3">
                {dashboard.blockers.map((blocker) => (
                  <div key={blocker.id} className="surface-soft p-5">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                      <p className="text-sm font-medium text-copy">{blocker.title}</p>
                    </div>
                    <p className="text-sm leading-6 text-muted">{blocker.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {dashboard.learningSignals.length === 0 && dashboard.blockers.length === 0 ? (
              <EmptyState
                eyebrow="Operator signal"
                title="No learning signals or blockers recorded"
                description="As replies, appointments, and ops notes accumulate, this panel will become the running memory of what to repeat and what to fix."
              />
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
