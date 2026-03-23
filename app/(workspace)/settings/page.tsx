import Link from "next/link";
import type { ReactNode } from "react";
import { DetailList } from "@/components/ui/detail-list";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getSettingsWorkspaceView } from "@/lib/data/selectors/settings";

export const metadata = {
  title: "Settings",
};

function InlinePill({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted">
      {label}
    </span>
  );
}

function InsetPanel({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <p className="micro-label">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BulletList({
  items,
  tone = "text-muted",
}: Readonly<{
  items: string[];
  tone?: string;
}>) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/80" />
          <p className={`text-sm leading-6 ${tone}`}>{item}</p>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const view = getSettingsWorkspaceView();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings / Control Plane"
        title="System configuration workspace"
        description="Review the current outbound operating system configuration before persistence, provider adapters, and external secrets are added. This workspace reads from typed config, typed mock repositories, and selector-backed control-plane view models."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/campaigns"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Review campaigns
            </Link>
            <Link
              href="/companies"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Open company queue
            </Link>
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="ICP configuration"
          description="Current ICP profiles, tier guidance, channel preference, pains, proof angles, and front-door offer recommendations."
        >
          <div className="space-y-4">
            {view.icpConfigurations.map((configuration) => (
              <div key={configuration.profile.id} className="surface-muted p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={configuration.statusBadge.label}
                        tone={configuration.statusBadge.tone}
                      />
                      <InlinePill label={configuration.profile.market} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-copy">
                      {configuration.profile.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {configuration.profile.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <DetailList
                    items={[
                      {
                        label: "Target industries",
                        value: configuration.targetIndustriesLabel,
                      },
                      {
                        label: "Target subindustries",
                        value: configuration.targetSubindustriesLabel,
                      },
                      {
                        label: "Preferred channels",
                        value:
                          configuration.preferredChannelLabels.join(" • ") ||
                          "None configured",
                      },
                      {
                        label: "First-offer recommendation",
                        value: `${configuration.firstOfferName} • ${configuration.firstOfferCategoryLabel}`,
                      },
                    ]}
                  />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <InsetPanel label="Dream fit summary">
                    <p className="text-sm leading-6 text-copy">
                      {configuration.dreamSummary}
                    </p>
                  </InsetPanel>
                  <InsetPanel label="Tier 2 summary">
                    <p className="text-sm leading-6 text-copy">
                      {configuration.tierTwoSummary}
                    </p>
                  </InsetPanel>
                  <InsetPanel label="Avoid summary">
                    <p className="text-sm leading-6 text-copy">
                      {configuration.avoidSummary}
                    </p>
                  </InsetPanel>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <InsetPanel label="Primary pains">
                    <BulletList items={configuration.profile.likelyPains} />
                  </InsetPanel>
                  <InsetPanel label="Proof angles">
                    <BulletList items={configuration.profile.proofAngles} />
                  </InsetPanel>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Offer configuration"
          description="Current seeded offers, their operating role, usage footprint, fit signals, pricing notes, and CTA guidance."
        >
          <div className="space-y-4">
            {view.offerConfigurations.map((configuration) => (
              <div key={configuration.offer.id} className="surface-muted p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={configuration.statusBadge.label}
                        tone={configuration.statusBadge.tone}
                      />
                      <InlinePill label={configuration.categoryLabel} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-copy">
                      {configuration.offer.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {configuration.offer.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <DetailList
                    items={[
                      {
                        label: "Offer role",
                        value: configuration.roleLabel,
                      },
                      {
                        label: "Availability",
                        value: configuration.usageLabel,
                      },
                      {
                        label: "Pricing notes",
                        value: configuration.pricingNotes,
                      },
                      {
                        label: "Problem solved",
                        value: configuration.offer.problemSolved,
                      },
                    ]}
                  />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <InsetPanel label="Fit signals">
                    <BulletList items={configuration.offer.fitSignals} />
                  </InsetPanel>
                  <InsetPanel label="CTA guidance">
                    <p className="text-sm leading-6 text-copy">
                      {configuration.ctaGuidance}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {configuration.offer.firstOutreachAngle}
                    </p>
                  </InsetPanel>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Scoring / priority configuration"
          description="Priority tiers, score buckets, recommended handling, visual treatment, and routing notes for queue management."
        >
          <div className="space-y-4">
            {view.scoringConfigurations.map((configuration) => (
              <div
                key={configuration.definition.tier}
                className="surface-muted p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={configuration.priorityBadge.label}
                        tone={configuration.priorityBadge.tone}
                      />
                      {configuration.scoringBucket ? (
                        <InlinePill
                          label={`${configuration.scoringBucket.label} bucket`}
                        />
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-copy">
                      {configuration.definition.label}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {configuration.definition.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <DetailList
                    items={[
                      {
                        label: "Score range",
                        value: configuration.scoreRangeLabel,
                      },
                      {
                        label: "Recommended offer",
                        value: configuration.recommendedOfferLabel,
                      },
                      {
                        label: "Recommended channels",
                        value: configuration.recommendedChannelsLabel,
                      },
                      {
                        label: "Bucket meaning",
                        value:
                          configuration.scoringBucket?.description ??
                          "Bucket alignment not configured",
                      },
                    ]}
                  />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <InsetPanel label="Visual status treatment">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge
                        label={configuration.priorityBadge.label}
                        tone={configuration.priorityBadge.tone}
                      />
                      <p className="text-sm leading-6 text-muted">
                        This tier uses the same priority signal treatment seen
                        across queue and review surfaces.
                      </p>
                    </div>
                  </InsetPanel>
                  <InsetPanel label="Readiness / routing notes">
                    <p className="text-sm leading-6 text-copy">
                      {configuration.routingNote}
                    </p>
                  </InsetPanel>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Workflow / channel configuration"
          description="Current outbound lanes, approval behavior, activation notes, and future placeholders for operator workflows."
        >
          <div className="space-y-4">
            {view.workflowConfigurations.map((configuration) => (
              <div
                key={configuration.configuration.key}
                className="surface-muted p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={configuration.statusBadge.label}
                        tone={configuration.statusBadge.tone}
                      />
                      <InlinePill label={configuration.roleLabel} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-copy">
                      {configuration.configuration.label}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {configuration.configuration.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <DetailList
                    items={[
                      {
                        label: "Objective",
                        value: configuration.configuration.objective,
                      },
                      {
                        label: "Approval behavior",
                        value: configuration.approvalModeLabel,
                      },
                      {
                        label: "Current coverage",
                        value: configuration.usageLabel,
                      },
                      {
                        label: "Provider binding",
                        value: configuration.configuration.channelKind
                          ? `${configuration.configuration.channelKind} contract available`
                          : "Workflow placeholder only",
                      },
                    ]}
                  />
                </div>

                <div className="mt-4">
                  <InsetPanel label="Activation notes">
                    <BulletList items={configuration.configuration.activationNotes} />
                  </InsetPanel>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Memory / learning configuration"
          description="A first-pass view of tracked outcomes, optimization targets, approval boundaries, and memory categories using mock/config-only settings."
        >
          <div className="space-y-4">
            <InsetPanel label="Learning policy">
              <p className="text-sm leading-6 text-copy">
                {view.learning.configuration.summary}
              </p>
            </InsetPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              {view.learning.outcomes.map((outcome) => (
                <div
                  key={outcome.configuration.key}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={outcome.statusBadge.label}
                      tone={outcome.statusBadge.tone}
                    />
                    <InlinePill
                      label={outcome.configuration.sourceEntityType.replaceAll(
                        "_",
                        " ",
                      )}
                    />
                  </div>
                  <p className="mt-4 text-base font-medium text-copy">
                    {outcome.configuration.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {outcome.configuration.summary}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted">
                    Current mock signal
                  </p>
                  <p className="mt-2 text-sm leading-6 text-copy">
                    {outcome.currentSignalLabel}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <InsetPanel label="Optimize for">
                <BulletList items={view.learning.configuration.optimizationTargets} />
              </InsetPanel>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="micro-label">Recommendation behavior</p>
                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-sm font-medium text-copy">
                      Approval required
                    </p>
                    <div className="mt-3">
                      <BulletList
                        items={view.learning.configuration.approvalRequiredBehaviors}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-copy">
                      Automatic recommendations
                    </p>
                    <div className="mt-3">
                      <BulletList
                        items={
                          view.learning.configuration
                            .automaticRecommendationBehaviors
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="micro-label">Memory entry categories</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {view.learning.memoryCategories.map((category) => (
                  <div
                    key={category.kind}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <InlinePill label={category.countLabel} />
                    </div>
                    <p className="mt-4 text-base font-medium text-copy">
                      {category.label}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {category.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Environment / integration readiness"
          description="Practical readiness state for future providers and infrastructure, represented as mock control-plane status only."
        >
          <div className="space-y-4">
            {view.integrationReadiness.map((integration) => (
              <div key={integration.check.key} className="surface-muted p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={integration.statusBadge.label}
                        tone={integration.statusBadge.tone}
                      />
                      <InlinePill label={integration.check.owner} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-copy">
                      {integration.check.label}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {integration.check.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <InsetPanel label="Next step">
                    <p className="text-sm leading-6 text-copy">
                      {integration.check.nextStep}
                    </p>
                  </InsetPanel>

                  <InsetPanel label="Blocked by">
                    <p className="text-sm leading-6 text-copy">
                      {integration.check.blockedBy ?? "No blocking dependency recorded"}
                    </p>
                  </InsetPanel>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
