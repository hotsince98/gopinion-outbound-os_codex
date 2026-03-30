import Link from "next/link";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { RecentReviewList } from "@/components/reviews/recent-review-list";
import { DetailList } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CompanyDetailView } from "@/lib/data/selectors/company-profile";

export type CompanyProfileSection =
  | "overview"
  | "website"
  | "reviews"
  | "contacts";

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
    <div className="surface-soft p-4">
      <p className="micro-label">{props.label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-copy">{props.value}</p>
    </div>
  );
}

function ProfileSectionTabs(props: Readonly<{
  links?: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
}>) {
  if (!props.links?.length) {
    return null;
  }

  return (
    <div className="surface-muted flex flex-wrap gap-2 p-2.5">
      {props.links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-[1.05rem] px-4 py-2.5 text-sm font-medium transition ${
            link.active
              ? "border border-accent/30 bg-accent/10 text-copy"
              : "border border-transparent bg-white/[0.02] text-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-copy"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function WebsiteDiscoveryCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
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
      <div className="surface-soft mt-4 p-4">
        <p className="micro-label">Official website</p>
        <p className="mt-2 break-words text-[0.96rem] font-medium leading-6 text-copy">
          {company.websiteDiscovery.officialWebsite ?? company.websiteDiscovery.candidate}
        </p>
      </div>
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        <MetaItem label="Discovery status" value={company.websiteDiscovery.label} />
        <MetaItem label="Preferred page" value={company.preferredSupportingPage.label} />
        <MetaItem
          label="Page source"
          value={company.preferredSupportingPage.sourceLabel}
        />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        {company.websiteDiscovery.reason}
      </p>
    </div>
  );
}

function RecentReviewsCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="surface-muted p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="micro-label">Recent public reviews</p>
        <StatusBadge
          label={company.reviewContext.badge.label}
          tone={company.reviewContext.badge.tone}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-copy">{company.reviewContext.summary}</p>
      <div className="surface-soft mt-4 p-4">
        <p className="micro-label">Review pressure summary</p>
        <p className="mt-2 text-sm leading-6 text-copy">
          {company.reviewContext.metaLabel}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {company.reviewContext.reviewCount} recent relevant review
          {company.reviewContext.reviewCount === 1 ? "" : "s"} on file
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
  );
}

function RecommendedContactCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="surface-muted p-5">
      <p className="micro-label">Recommended outreach contact</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          label={company.topRecommendedContact.qualityBadge.label}
          tone={company.topRecommendedContact.qualityBadge.tone}
        />
      </div>
      <div className="surface-soft mt-4 p-4">
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
  );
}

function AngleReadinessCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
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
      <div className="surface-soft mt-4 p-4">
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
  );
}

function FitReputationCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
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
  );
}

function PainsNotesCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
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
  );
}

function DecisionMakerCoverageCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="surface-muted p-5">
      <p className="micro-label">Decision-maker coverage</p>
      <div className="mt-3 space-y-3">
        {company.contacts.length > 0 ? (
          company.contacts.map((contact) => (
            <div key={contact.id} className="surface-soft p-4">
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
  );
}

function OverviewSection({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <WebsiteDiscoveryCard company={company} />
        <RecentReviewsCard company={company} />
      </div>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <RecommendedContactCard company={company} />
        <AngleReadinessCard company={company} />
      </div>
    </>
  );
}

function WebsiteSection({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
      <WebsiteDiscoveryCard company={company} />
      <FitReputationCard company={company} />
    </div>
  );
}

function ReviewsSection({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
      <RecentReviewsCard company={company} />
      <PainsNotesCard company={company} />
    </div>
  );
}

function ContactsSection({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
        <RecommendedContactCard company={company} />
        <FitReputationCard company={company} />
      </div>
      <DecisionMakerCoverageCard company={company} />
    </div>
  );
}

export function SelectedCompanyProfile({
  company,
  section = "overview",
  sectionLinks,
}: Readonly<{
  company?: CompanyDetailView;
  section?: CompanyProfileSection;
  sectionLinks?: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
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

  const showFullProfile = !sectionLinks?.length;

  return (
    <SectionCard
      title={company.companyName}
      description={`${company.market} • ${company.subindustry} • ${company.icpLabel}`}
      contentClassName="space-y-6"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.85fr)]">
        <div className="surface-elevated p-6">
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
          <div className="mt-5 space-y-3">
            <p className="text-base font-medium tracking-[-0.01em] text-copy">
              {company.reviewSnapshot}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={company.reviewContext.badge.label}
                tone={company.reviewContext.badge.tone}
              />
              <p className="text-sm text-muted">{company.reviewContext.metaLabel}</p>
            </div>
          </div>
          <div className="surface-soft mt-5 p-4">
            <p className="micro-label">Suggested next action</p>
            <p className="mt-3 text-sm leading-6 text-copy">
              {company.suggestedNextAction}
            </p>
          </div>
        </div>

        <div className="surface-muted p-5">
          <p className="micro-label">Confidence overview</p>
          <div className="mt-4">
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

      <ProfileSectionTabs links={sectionLinks} />

      {showFullProfile ? (
        <div className="space-y-5">
          <OverviewSection company={company} />
          <WebsiteSection company={company} />
          <ReviewsSection company={company} />
          <ContactsSection company={company} />
        </div>
      ) : null}
      {!showFullProfile && section === "website" ? (
        <WebsiteSection company={company} />
      ) : null}
      {!showFullProfile && section === "reviews" ? (
        <ReviewsSection company={company} />
      ) : null}
      {!showFullProfile && section === "contacts" ? (
        <ContactsSection company={company} />
      ) : null}
      {!showFullProfile && section === "overview" ? (
        <OverviewSection company={company} />
      ) : null}
    </SectionCard>
  );
}
