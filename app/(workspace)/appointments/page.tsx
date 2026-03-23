import Link from "next/link";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { getAppointmentsWorkspaceView } from "@/lib/data/selectors/appointments";
import { buildPathWithQuery } from "@/lib/utils";

export const metadata = {
  title: "Appointments",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const view = await getAppointmentsWorkspaceView(await searchParams);

  const rows = view.rows.map((row) => ({
    id: row.appointmentId,
    cells: [
      <div key={`${row.appointmentId}-company`} className="space-y-2">
        <Link
          href={buildPathWithQuery("/appointments", view.query, {
            appointmentId: row.appointmentId,
          })}
          className="font-medium text-copy transition hover:text-accent"
        >
          {row.companyName}
        </Link>
        <p className="text-sm text-muted">{row.contactName}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {row.market}
        </p>
      </div>,
      <p key={`${row.appointmentId}-when`} className="text-sm leading-6 text-copy">
        {row.scheduledForLabel}
      </p>,
      <div key={`${row.appointmentId}-status`} className="space-y-2">
        <StatusBadge label={row.statusBadge.label} tone={row.statusBadge.tone} />
        <StatusBadge
          label={row.confirmationBadge.label}
          tone={row.confirmationBadge.tone}
        />
      </div>,
      <p key={`${row.appointmentId}-campaign`} className="text-sm leading-6 text-copy">
        {row.campaignName}
      </p>,
      <p key={`${row.appointmentId}-offer`} className="text-sm leading-6 text-copy">
        {row.offerName}
      </p>,
      <p key={`${row.appointmentId}-next`} className="text-sm leading-6 text-muted">
        {row.nextAction}
      </p>,
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Appointments Pipeline"
        title="Booked meetings and near-term follow-up"
        description="Tracks typed appointments sourced from reply records so the system can move cleanly from outbound interest into confirmed meetings and operator follow-through."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={buildPathWithQuery("/appointments", view.query, {
                window: "today",
                appointmentId: null,
              })}
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Today
            </Link>
            <Link
              href={buildPathWithQuery("/appointments", view.query, {
                confirmation: "pending",
                appointmentId: null,
              })}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Pending confirm
            </Link>
            <Link
              href="/inbox?classification=positive"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Booking replies
            </Link>
            {view.hasActiveFilters ? (
              <Link
                href="/appointments"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <input
            type="hidden"
            name="appointmentId"
            value={view.filters.values.appointmentId}
          />

          <label className="space-y-2 2xl:col-span-2">
            <span className="micro-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={view.filters.values.q}
              placeholder="Search company, contact, campaign, or notes"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
            />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Status</span>
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
            <span className="micro-label">Confirmation</span>
            <select
              name="confirmation"
              defaultValue={view.filters.values.confirmation}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.confirmationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="micro-label">Date window</span>
            <select
              name="window"
              defaultValue={view.filters.values.window}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition focus:border-accent/35 focus:bg-white/[0.05]"
            >
              {view.filters.windowOptions.map((option) => (
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Appointments and booking queue"
          description={`${view.resultLabel}. Keep scheduling pressure, confirmation risk, and next operator actions visible in one place.`}
        >
          <TableShell
            columns={[
              "Company / contact",
              "Booked for",
              "Status",
              "Attributed campaign",
              "Offer",
              "Next action",
            ]}
            rows={rows}
            emptyTitle={view.emptyState.title}
            emptyDescription={view.emptyState.description}
          />
        </SectionCard>

        <SectionCard
          title="Selected appointment"
          description="A typed appointment detail view with campaign attribution, reply source, and recommended follow-up."
        >
          {view.selectedAppointment ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={view.selectedAppointment.statusBadge.label}
                    tone={view.selectedAppointment.statusBadge.tone}
                  />
                  <StatusBadge
                    label={view.selectedAppointment.confirmationBadge.label}
                    tone={view.selectedAppointment.confirmationBadge.tone}
                  />
                </div>

                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-copy">
                    {view.selectedAppointment.companyName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {view.selectedAppointment.contactName} •{" "}
                    {view.selectedAppointment.contactRole} •{" "}
                    {view.selectedAppointment.market}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
                    Scheduled {view.selectedAppointment.scheduledForLabel}
                  </p>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Recommended follow-up</p>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedAppointment.recommendedFollowUpStep}
                  </p>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Pipeline context</p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {view.selectedAppointment.campaignName} •{" "}
                    {view.selectedAppointment.offerName} •{" "}
                    {view.selectedAppointment.icpLabel}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-copy">
                    {view.selectedAppointment.sequenceContext}
                  </p>
                </div>
              </div>

              <DetailList items={view.selectedAppointment.basics} />
              <DetailList items={view.selectedAppointment.sourceContext} />

              {view.selectedAppointment.sourceReply ? (
                <div className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="micro-label">Source reply</p>
                    <StatusBadge
                      label={view.selectedAppointment.sourceReply.classificationBadge.label}
                      tone={view.selectedAppointment.sourceReply.classificationBadge.tone}
                    />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted">
                    Received {view.selectedAppointment.sourceReply.receivedAtLabel}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {view.selectedAppointment.sourceReply.preview}
                  </p>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-copy">
                    {view.selectedAppointment.sourceReply.bodyText}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-muted p-4">
                  <p className="micro-label">Notes</p>
                  <div className="mt-3 space-y-2">
                    {view.selectedAppointment.notes.length > 0 ? (
                      view.selectedAppointment.notes.map((note) => (
                        <p key={note} className="text-sm leading-6 text-muted">
                          {note}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        No appointment notes are attached yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="surface-muted p-4">
                  <p className="micro-label">Insights</p>
                  <div className="mt-3 space-y-2">
                    {view.selectedAppointment.insights.length > 0 ? (
                      view.selectedAppointment.insights.map((insight) => (
                        <p key={insight} className="text-sm leading-6 text-muted">
                          {insight}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        No linked insights are attached to this appointment yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="Appointment detail"
              title="Select an appointment to inspect it"
              description="Pick a meeting from the pipeline to review confirmation state, campaign source, source reply, and follow-up guidance."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
