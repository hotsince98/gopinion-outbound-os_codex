import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
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
        <p className="font-medium text-copy">{lead.companyName}</p>
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
        title="Dealer-first outbound command deck"
        description="Track execution across lead qualification, campaigns, reply flow, and booking readiness. This shell now reads from typed domain entities through the shared repository boundary, whether the backend is mock or Supabase-backed."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
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

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard
          title="Priority dealer queue"
          description="Highest-signal accounts that should be ready for human review before enrollment."
        >
          <TableShell
            columns={["Company", "Offer", "Decision-maker hypothesis", "Next step"]}
            rows={priorityRows}
            emptyTitle="No priority companies yet"
            emptyDescription="The current backend has no qualified or campaign-ready companies. Seed the supported Postgres tables or switch back to mock mode if you want demo data."
          />
        </SectionCard>

        <SectionCard
          title="Learning signals"
          description="Outcome notes the system should eventually capture as structured insights."
        >
          {dashboard.learningSignals.length > 0 ? (
            <div className="space-y-3">
              {dashboard.learningSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="surface-muted p-4 transition hover:border-white/12 hover:bg-white/[0.05]"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-copy">{signal.title}</p>
                    <span className="micro-label">{signal.tag}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted">{signal.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Learning"
              title="No learning signals yet"
              description="Replies, appointments, and insight records have not generated any structured learning signals in the current backend."
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
          title="Pipeline blockers"
          description="Operational friction points that still need data or workflow coverage."
        >
          {dashboard.blockers.length > 0 ? (
            <div className="space-y-3">
              {dashboard.blockers.map((blocker) => (
                <div key={blocker.id} className="surface-muted p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                    <p className="text-sm font-medium text-copy">{blocker.title}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted">{blocker.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Blockers"
              title="No active blockers recorded"
              description="The current data snapshot has no stored constraint notes to surface here."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
