import { StatusBadge } from "@/components/ui/status-badge";
import type { CampaignSequenceSummaryView } from "@/lib/data/selectors/campaigns";

export function SequenceSummary({
  summary,
}: Readonly<{
  summary: CampaignSequenceSummaryView;
}>) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-muted p-4">
          <p className="micro-label">Current version</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={summary.statusBadge.label}
              tone={summary.statusBadge.tone}
            />
            <span className="text-sm font-medium text-copy">
              {summary.versionLabel}
            </span>
          </div>
        </div>
        <div className="surface-muted p-4">
          <p className="micro-label">Offer</p>
          <p className="mt-3 text-sm leading-6 text-copy">{summary.offerName}</p>
        </div>
        <div className="surface-muted p-4">
          <p className="micro-label">Tier</p>
          <p className="mt-3 text-sm leading-6 text-copy">
            {summary.targetTierLabel}
          </p>
        </div>
        <div className="surface-muted p-4">
          <p className="micro-label">Sequence shape</p>
          <p className="mt-3 text-sm leading-6 text-copy">
            {summary.stepCountLabel}
          </p>
        </div>
      </div>

      <div className="surface-muted p-4">
        <p className="micro-label">Audience + goal</p>
        <p className="mt-3 text-sm leading-6 text-copy">
          {summary.audienceSummary}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">{summary.goal}</p>
      </div>

      <div className="space-y-3">
        <p className="micro-label">Sequence versions</p>
        <div className="grid gap-3">
          {summary.versions.map((version) => (
            <article key={version.sequenceId} className="surface-muted p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={version.statusBadge.label}
                  tone={version.statusBadge.tone}
                />
                <span className="text-sm font-medium text-copy">
                  {version.versionLabel}
                </span>
                {version.isCurrent ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-copy">
                {version.description}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{version.goal}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="micro-label">Sequence steps</p>
        <div className="grid gap-3">
          {summary.steps.map((step) => (
            <article key={step.id} className="surface-muted p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-copy">
                  Step {step.stepNumber}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
                  {step.stepType}
                </span>
                <span className="text-xs uppercase tracking-[0.18em] text-muted">
                  {step.delayLabel}
                </span>
              </div>
              <p className="mt-3 text-base font-medium text-copy">{step.subject}</p>
              <p className="mt-3 text-sm leading-6 text-muted">{step.bodyPreview}</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="micro-label">Goal</p>
                  <p className="mt-2 text-sm leading-6 text-copy">{step.goal}</p>
                </div>
                <div>
                  <p className="micro-label">CTA</p>
                  <p className="mt-2 text-sm leading-6 text-copy">{step.cta}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
