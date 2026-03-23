import Link from "next/link";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getInboxWorkspaceView } from "@/lib/data/selectors/inbox";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const view = await getInboxWorkspaceView(await searchParams);

  const rows = view.rows.map((row) => ({
    id: row.replyId,
    cells: [
      <div key={`${row.replyId}-company`} className="space-y-2">
        <Link
          href={buildPathWithQuery("/inbox", view.query, {
            replyId: row.replyId,
          })}
          className="font-medium text-copy transition hover:text-accent"
        >
          {row.companyName}
        </Link>
        <p className="text-sm text-muted">{row.contactName}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.icpLabel}
        </p>
      </div>,
      <div key={`${row.replyId}-campaign`} className="space-y-2">
        <p className="text-sm font-medium text-copy">{row.campaignName}</p>
        <p className="text-sm text-muted">{row.offerName}</p>
      </div>,
      <div key={`${row.replyId}-classification`} className="space-y-2">
        <StatusBadge
          label={row.classificationBadge.label}
          tone={row.classificationBadge.tone}
        />
        {row.sentimentBadge ? (
          <StatusBadge
            label={row.sentimentBadge.label}
            tone={row.sentimentBadge.tone}
          />
        ) : null}
        <StatusBadge label={row.reviewBadge.label} tone={row.reviewBadge.tone} />
      </div>,
      <div key={`${row.replyId}-next-action`} className="space-y-2">
        <p className="text-sm leading-6 text-copy">{row.nextAction}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Received {row.receivedAtLabel}
        </p>
      </div>,
      <p
        key={`${row.replyId}-preview`}
        className="max-w-xl text-sm leading-6 text-muted"
      >
        {row.latestReplyPreview}
      </p>,
      <div key={`${row.replyId}-pipeline`} className="space-y-2">
        <StatusBadge label={row.pipelineBadge.label} tone={row.pipelineBadge.tone} />
        <p className="text-sm text-muted">{row.pipelineLabel}</p>
      </div>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reply Inbox"
        title="Operational inbox and booking handoff"
        description="Triages typed reply records into clear next actions so outreach can move into booking, nurture, suppression, or manual handling without inventing page-only workflow state."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={buildPathWithQuery("/inbox", view.query, {
                review: "requires_review",
                replyId: null,
              })}
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Needs review
            </Link>
            <Link
              href={buildPathWithQuery("/inbox", view.query, {
                classification: "positive",
                replyId: null,
              })}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Interested replies
            </Link>
            <Link
              href="/appointments"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Open pipeline
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/inbox"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
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
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <input type="hidden" name="replyId" value={view.filters.values.replyId} />

          <label className="space-y-2 2xl:col-span-2">
            <span className="micro-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={view.filters.values.q}
              placeholder="Search company, contact, campaign, or reply text"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
            />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Classification</span>
            <select
              name="classification"
              defaultValue={view.filters.values.classification}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.classificationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="micro-label">Campaign</span>
            <select
              name="campaign"
              defaultValue={view.filters.values.campaign}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.campaignOptions.map((option) => (
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
            <span className="micro-label">Human review</span>
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
            <span className="micro-label">Enrollment state</span>
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
            <span className="micro-label">Date window</span>
            <select
              name="date"
              defaultValue={view.filters.values.date}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 xl:self-end"
          >
            Apply filters
          </button>
        </form>
      </FilterPanel>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Reply triage queue"
          description={`${view.resultLabel}. Use this inbox to classify replies, route the next action, and keep booking handoff visible without losing campaign context.`}
        >
          <TableShell
            columns={[
              "Company / contact",
              "Campaign / offer",
              "Classification",
              "Recommended next action",
              "Latest reply",
              "Pipeline",
            ]}
            rows={rows}
            emptyTitle={view.emptyState.title}
            emptyDescription={view.emptyState.description}
          />
        </SectionCard>

        <SectionCard
          title="Selected reply"
          description="An actionable reply detail view that stays grounded in the typed reply, enrollment, campaign, and appointment entities."
        >
          {view.selectedReply ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={view.selectedReply.classificationBadge.label}
                    tone={view.selectedReply.classificationBadge.tone}
                  />
                  {view.selectedReply.sentimentBadge ? (
                    <StatusBadge
                      label={view.selectedReply.sentimentBadge.label}
                      tone={view.selectedReply.sentimentBadge.tone}
                    />
                  ) : null}
                  <StatusBadge
                    label={view.selectedReply.reviewBadge.label}
                    tone={view.selectedReply.reviewBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedReply.handlingBadge.label}
                    tone={view.selectedReply.handlingBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedReply.enrollmentStateBadge.label}
                    tone={view.selectedReply.enrollmentStateBadge.tone}
                  />
                </div>

                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-copy">
                    {view.selectedReply.companyName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {view.selectedReply.contactName} • {view.selectedReply.contactRole} •{" "}
                    {view.selectedReply.market}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
                    Received {view.selectedReply.receivedAtLabel}
                  </p>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Recommended next action</p>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedReply.recommendedNextAction}
                  </p>
                </div>

                <div className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="micro-label">Route this reply</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">
                      {view.selectedReply.handlingSummary}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {view.selectedReply.campaignName} • {view.selectedReply.offerName} •{" "}
                    {view.selectedReply.icpLabel}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedReply.sequenceContext}
                  </p>
                </div>
              </div>

              <div className="surface-muted p-4">
                <p className="micro-label">Latest reply</p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {view.selectedReply.latestReplyPreview}
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-copy">
                  {view.selectedReply.latestReplyText}
                </p>
              </div>

              <DetailList items={view.selectedReply.companyContext} />
              <DetailList items={view.selectedReply.campaignContext} />
              <DetailList items={view.selectedReply.enrollmentContext} />

              {view.selectedReply.relatedAppointment ? (
                <div className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="micro-label">Linked appointment</p>
                    <StatusBadge
                      label={view.selectedReply.relatedAppointment.statusBadge.label}
                      tone={view.selectedReply.relatedAppointment.statusBadge.tone}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedReply.relatedAppointment.scheduledForLabel} •{" "}
                    {view.selectedReply.relatedAppointment.timezone}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {view.selectedReply.relatedAppointment.notes}
                  </p>
                  <Link
                    href={`/appointments?appointmentId=${view.selectedReply.relatedAppointment.appointmentId}`}
                    className="mt-4 inline-flex text-sm font-medium text-accent transition hover:text-copy"
                  >
                    Open appointment detail
                  </Link>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-muted p-4">
                  <p className="micro-label">Notes and context</p>
                  <div className="mt-3 space-y-2">
                    {view.selectedReply.notes.length > 0 ? (
                      view.selectedReply.notes.map((note) => (
                        <p key={note} className="text-sm leading-6 text-muted">
                          {note}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        No extra operator notes are attached to this reply yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Insights</p>
                  <div className="mt-3 space-y-2">
                    {view.selectedReply.insights.length > 0 ? (
                      view.selectedReply.insights.map((insight) => (
                        <p key={insight} className="text-sm leading-6 text-muted">
                          {insight}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        No linked insights are attached yet for this reply path.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="Reply detail"
              title="Select a reply to inspect it"
              description="Pick a thread from the inbox to review its classification, booking path, enrollment state, and recommended next step."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
