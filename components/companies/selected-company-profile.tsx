import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { RecentReviewList } from "@/components/reviews/recent-review-list";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CompanyDetailView } from "@/lib/data/selectors/company-profile";

function TextList(props: Readonly<{ items: string[]; empty: string }>) {
  const items = props.items.filter(Boolean);

  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted">{props.empty}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <p key={item} className="text-sm leading-6 text-muted">
          {item}
        </p>
      ))}
    </div>
  );
}

function MetaItem(props: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
      <p className="micro-label">{props.label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-copy">{props.value}</p>
    </div>
  );
}

export function SelectedCompanyProfile({
  company,
}: Readonly<{
  company?: CompanyDetailView;
}>) {
  if (!company) {
    return (
      <SectionCard
        title="Selected company"
        description="Pick a company from the queue to open its website, contact, and readiness profile."
      >
        <EmptyState
          eyebrow="Company detail"
          title="Select a company to inspect it"
          description="The center workspace expands the chosen company into a clearer operator profile so you can review one account deeply before taking action."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={company.companyName}
      description={`${company.market} • ${company.subindustry} • ${company.icpLabel}`}
      contentClassName="space-y-5"
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <div className="surface-muted p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={company.priorityBadge.label}
              tone={company.priorityBadge.tone}
            />
            <StatusBadge
              label={company.statusBadge.label}
              tone={company.statusBadge.tone}
            />
            <StatusBadge
              label={company.readinessBadge.label}
              tone={company.readinessBadge.tone}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-copy">{company.reviewSnapshot}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={company.reviewContext.badge.label}
              tone={company.reviewContext.badge.tone}
            />
            <p className="text-sm text-muted">{company.reviewContext.metaLabel}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Suggested next action</p>
            <p className="mt-3 text-sm leading-6 text-copy">
              {company.suggestedNextAction}
            </p>
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Confidence overview</p>
          <div className="mt-3">
            <ConfidenceBreakdown
              items={[
                {
                  label:
                    company.confidenceBreakdown[0]?.label ??
                    "Website discovery confidence",
                  badge: company.websiteDiscovery.confidenceBadge,
                },
                {
                  label:
                    company.confidenceBreakdown[1]?.label ??
                    "Primary contact quality",
                  badge: company.topRecommendedContact.qualityBadge,
                },
                {
                  label:
                    company.confidenceBreakdown[2]?.label ??
                    "Outreach-angle confidence",
                  badge: company.outreachAngle.confidenceBadge,
                },
                {
                  label:
                    company.confidenceBreakdown[3]?.label ??
                    "Overall readiness confidence",
                  badge: company.readinessConfidenceBadge,
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <div className="surface-muted p-5">
          <p className="micro-label">Website and discovery</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={company.websiteDiscovery.confirmationBadge.label}
              tone={company.websiteDiscovery.confirmationBadge.tone}
            />
            <StatusBadge
              label={company.websiteDiscovery.confidenceBadge.label}
              tone={company.websiteDiscovery.confidenceBadge.tone}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Official website</p>
            <p className="mt-2 break-words text-[0.95rem] font-medium leading-6 text-copy">
              {company.websiteDiscovery.officialWebsite ?? company.websiteDiscovery.candidate}
            </p>
          </div>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            <MetaItem label="Discovery status" value={company.websiteDiscovery.label} />
            <MetaItem
              label="Preferred page"
              value={company.preferredSupportingPage.label}
            />
            <MetaItem
              label="Page source"
              value={company.preferredSupportingPage.sourceLabel}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            {company.websiteDiscovery.reason}
          </p>
        </div>

        <div className="surface-muted p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="micro-label">Recent public reviews</p>
            <StatusBadge
              label={company.reviewContext.badge.label}
              tone={company.reviewContext.badge.tone}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-copy">{company.reviewContext.summary}</p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Review pressure summary</p>
            <p className="mt-2 text-sm leading-6 text-copy">
              {company.reviewContext.metaLabel}
            </p>
          </div>
          <div className="mt-4">
            <RecentReviewList
              items={company.reviewContext.reviews}
              maxItems={3}
              emptyMessage="No recent review snippets are attached on this company yet."
            />
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Recommended outreach contact</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={company.topRecommendedContact.qualityBadge.label}
              tone={company.topRecommendedContact.qualityBadge.tone}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Primary outreach path</p>
            <p className="mt-2 text-base font-medium text-copy">
              {company.topRecommendedContact.label}
            </p>
            <p className="mt-2 text-sm text-muted">{company.contactSummary.totalLabel}</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            {company.topRecommendedContact.reason}
          </p>
          <div className="mt-4">
            <ContactRankingStack
              totalLabel={company.contactSummary.totalLabel}
              items={company.contactSummary.highlights}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <div className="surface-muted p-5">
          <p className="micro-label">Angle and readiness</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={company.outreachAngle.urgencyBadge.label}
              tone={company.outreachAngle.urgencyBadge.tone}
            />
            <StatusBadge
              label={company.outreachAngle.confidenceBadge.label}
              tone={company.outreachAngle.confidenceBadge.tone}
            />
            <StatusBadge
              label={company.outreachAngle.reviewPathBadge.label}
              tone={company.outreachAngle.reviewPathBadge.tone}
            />
          </div>
          <p className="mt-3 text-base font-medium text-copy">
            {company.outreachAngle.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-copy">
            {company.outreachAngle.reason}
          </p>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            <MetaItem label="Segment lens" value={company.outreachAngle.segmentLabel} />
            <MetaItem label="Offer CTA" value={company.recommendedOffer.cta} />
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="micro-label">Recommended offer</p>
            <p className="mt-3 text-base font-medium text-copy">
              {company.recommendedOffer.name}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {company.recommendedOffer.description}
            </p>
            <p className="mt-3 text-sm leading-6 text-copy">
              {company.recommendedOffer.angle}
            </p>
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Fit and reputation context</p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-sm font-medium text-copy">Company basics</p>
              <div className="mt-3">
                <DetailList items={company.basics} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-copy">Reputation signals</p>
              <div className="mt-3">
                <DetailList items={company.reputation} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(26rem,1fr))]">
        <div className="surface-muted p-5">
          <p className="micro-label">Likely pains and operator notes</p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-sm font-medium text-copy">Pain signals</p>
              <div className="mt-2">
                <TextList
                  items={company.pains}
                  empty="No pain signals are stored on the record yet."
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-copy">Notes</p>
              <div className="mt-2">
                <TextList
                  items={company.notes}
                  empty="No additional operator notes are attached yet."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Decision-maker coverage</p>
          <div className="mt-3 space-y-3">
            {company.contacts.length > 0 ? (
              company.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-2xl border border-white/8 bg-black/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-medium text-copy">
                          {contact.name}
                        </p>
                        {contact.isPrimary ? (
                          <StatusBadge label="Primary" tone="success" />
                        ) : null}
                        <StatusBadge
                          label={contact.organizationBadge.label}
                          tone={contact.organizationBadge.tone}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted">{contact.role}</p>
                      {contact.email ? (
                        <p className="mt-1 break-all text-sm text-copy">{contact.email}</p>
                      ) : null}
                      {contact.phone ? (
                        <p className="mt-1 text-sm text-muted">{contact.phone}</p>
                      ) : null}
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        {contact.confidence}
                      </p>
                      <p className="mt-1 text-sm text-copy">
                        {contact.quality} • {contact.campaignEligibility}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {contact.selectionLabel} • {contact.selectionScore}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 break-words text-sm leading-6 text-muted">
                    {contact.source}
                  </p>
                  {contact.readinessReason ? (
                    <p className="mt-2 text-sm leading-6 text-copy">
                      {contact.readinessReason}
                    </p>
                  ) : null}
                  {contact.selectionReasons.map((reason) => (
                    <p key={reason} className="mt-2 text-sm leading-6 text-muted">
                      {reason}
                    </p>
                  ))}
                  {contact.demotionReasons.map((reason) => (
                    <p key={reason} className="mt-2 text-sm leading-6 text-muted">
                      {reason}
                    </p>
                  ))}
                  {contact.warnings.map((warning) => (
                    <p key={warning} className="mt-2 text-sm leading-6 text-warning">
                      {warning}
                    </p>
                  ))}
                </div>
              ))
            ) : (
              <EmptyState
                eyebrow="Contacts"
                title="No decision-maker coverage yet"
                description="This company still needs contact sourcing before outreach can become operational."
              />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
