import Link from "next/link";
import { ConfidenceBreakdown } from "@/components/enrichment/confidence-breakdown";
import { ContactRankingStack } from "@/components/enrichment/contact-ranking-stack";
import { ProviderRunSummary } from "@/components/enrichment/provider-run-summary";
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
    <div className="surface-soft min-w-0 p-4">
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

function ReviewTraceLabel(company: CompanyDetailView) {
  return [
    company.websiteDiscovery.reviewSourceLabel,
    company.websiteDiscovery.reviewedAtLabel,
  ]
    .filter(Boolean)
    .join(" • ");
}

function CandidateDiagnostics({
  diagnostics,
}: Readonly<{
  diagnostics: string[];
}>) {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-2">
      <p className="micro-label">Discovery diagnostics</p>
      {diagnostics.map((item) => (
        <p key={item} className="text-sm leading-6 text-muted">
          {item}
        </p>
      ))}
    </div>
  );
}

function WebsiteDiscoveryCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  const reviewTrace = ReviewTraceLabel(company);

  return (
    <div className="surface-muted p-6 lg:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="micro-label">Website and discovery</p>
          <p className="mt-3 break-words text-[1.05rem] font-medium tracking-[-0.01em] text-copy">
            {company.websiteDiscovery.officialWebsite ?? company.websiteDiscovery.candidate}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            {company.websiteDiscovery.reason}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={company.websiteDiscovery.confirmationBadge.label}
            tone={company.websiteDiscovery.confirmationBadge.tone}
          />
          <StatusBadge
            label={company.websiteDiscovery.confidenceBadge.label}
            tone={company.websiteDiscovery.confidenceBadge.tone}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <MetaItem label="Discovery status" value={company.websiteDiscovery.label} />
        <MetaItem
          label="Preferred page"
          value={company.preferredSupportingPage.label}
        />
        <MetaItem
          label="Page source"
          value={company.preferredSupportingPage.sourceLabel}
        />
        <MetaItem
          label="Review trace"
          value={reviewTrace || "Awaiting manual review"}
        />
      </div>

      {company.preferredSupportingPage.url || company.preferredSupportingPage.reason ? (
        <div className="surface-soft mt-5 p-5">
          <p className="micro-label">Preferred supporting page</p>
          {company.preferredSupportingPage.url ? (
            <a
              href={company.preferredSupportingPage.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-words text-sm font-medium text-copy transition hover:text-accent"
            >
              {company.preferredSupportingPage.url}
            </a>
          ) : null}
          {company.preferredSupportingPage.reason ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              {company.preferredSupportingPage.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      <CandidateDiagnostics diagnostics={company.websiteDiscovery.candidateDiagnostics} />
    </div>
  );
}

function RecentReviewsCard({
  company,
  maxItems = 3,
  compactList = false,
}: Readonly<{
  company: CompanyDetailView;
  maxItems?: number;
  compactList?: boolean;
}>) {
  return (
    <div className="surface-muted p-6 lg:p-7">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="micro-label">Recent public reviews</p>
            <StatusBadge
              label={company.reviewContext.badge.label}
              tone={company.reviewContext.badge.tone}
            />
          </div>
          <p className="mt-3 text-sm leading-7 text-copy">
            {company.reviewContext.summary}
          </p>
        </div>
        <div className="surface-soft p-4">
          <p className="micro-label">Review pressure summary</p>
          <p className="mt-2 text-sm leading-6 text-copy">
            {company.reviewContext.metaLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {company.reviewContext.reviewCount} recent relevant review
            {company.reviewContext.reviewCount === 1 ? "" : "s"} on file
          </p>
        </div>
      </div>

      <div className="mt-5">
        <RecentReviewList
          items={company.reviewContext.reviews}
          maxItems={maxItems}
          compact={compactList}
          emptyMessage="No recent review snippets are attached on this company yet."
        />
      </div>
    </div>
  );
}

function CompactContactHighlights({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  const highlights = company.contactSummary.highlights.slice(0, 2);

  if (highlights.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted">
        No ranked contact paths are available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {highlights.map((item) => (
        <div key={item.id} className="surface-soft p-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={item.slotLabel}
              tone={item.slotLabel === "Primary" ? "success" : "accent"}
            />
            <StatusBadge
              label={item.qualityBadge.label}
              tone={item.qualityBadge.tone}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-copy">{item.label}</p>
          <p className="mt-1 text-sm text-muted">{item.roleLabel}</p>
        </div>
      ))}
    </div>
  );
}

function RecommendedContactCard({
  company,
  showRanking = false,
}: Readonly<{
  company: CompanyDetailView;
  showRanking?: boolean;
}>) {
  return (
    <div className="surface-muted p-6 lg:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <p className="micro-label">Recommended outreach contact</p>
        <StatusBadge
          label={company.topRecommendedContact.qualityBadge.label}
          tone={company.topRecommendedContact.qualityBadge.tone}
        />
      </div>

      <p className="mt-4 text-[1.02rem] font-medium tracking-[-0.01em] text-copy">
        {company.topRecommendedContact.label}
      </p>
      <p className="mt-2 text-sm text-muted">{company.contactSummary.totalLabel}</p>
      <p className="mt-4 text-sm leading-7 text-copy">
        {company.topRecommendedContact.reason}
      </p>

      <div className="mt-5">
        {showRanking ? (
          <ContactRankingStack
            totalLabel={company.contactSummary.totalLabel}
            items={company.contactSummary.highlights}
          />
        ) : (
          <CompactContactHighlights company={company} />
        )}
      </div>
    </div>
  );
}

function OutreachPlanCard({
  company,
  showCampaignSummary = true,
}: Readonly<{
  company: CompanyDetailView;
  showCampaignSummary?: boolean;
}>) {
  return (
    <div className="surface-muted p-6 lg:p-7">
      <div className="flex flex-wrap gap-2">
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

      <p className="mt-4 text-[1.02rem] font-medium tracking-[-0.01em] text-copy">
        {company.outreachAngle.label}
      </p>
      <p className="mt-3 text-sm leading-7 text-muted">
        {company.outreachAngle.reason}
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <MetaItem label="Segment lens" value={company.outreachAngle.segmentLabel} />
        <MetaItem label="Offer CTA" value={company.recommendedOffer.cta} />
      </div>

      <div className="surface-soft mt-5 p-5">
        <p className="micro-label">Recommended offer</p>
        <p className="mt-3 text-sm font-medium text-copy">
          {company.recommendedOffer.name}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {company.recommendedOffer.description}
        </p>
        <p className="mt-3 text-sm leading-6 text-copy">
          {company.recommendedOffer.angle}
        </p>
      </div>

      {showCampaignSummary ? (
        <div className="mt-5 space-y-2">
          <p className="micro-label">Campaign context</p>
          {company.campaignSummary.map((item) => (
            <p key={item} className="text-sm leading-6 text-muted">
              {item}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FitReputationCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="surface-muted p-6 lg:p-7">
      <div className="space-y-5">
        <div>
          <p className="micro-label">Company basics</p>
          <div className="mt-4">
            <DetailList items={company.basics} />
          </div>
        </div>
        <div>
          <p className="micro-label">Reputation signals</p>
          <div className="mt-4">
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
    <div className="surface-muted p-6 lg:p-7">
      <div className="space-y-5">
        <div>
          <p className="micro-label">Likely pains</p>
          <div className="mt-3">
            <TextList
              items={company.pains}
              empty="No pain signals are stored on the record yet."
            />
          </div>
        </div>
        <div>
          <p className="micro-label">Operator notes</p>
          <div className="mt-3">
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

function ProviderTransparencyCard({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="surface-muted p-6 lg:p-7">
      <p className="micro-label">Provider transparency</p>
      <div className="mt-4">
        <ProviderRunSummary
          badge={company.providerTransparency.badge}
          label={company.providerTransparency.label}
          fallback={company.providerTransparency.fallback}
          evidence={company.providerTransparency.evidence}
          pageUsage={company.providerTransparency.pageUsage}
        />
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
    <div className="surface-muted p-6 lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="micro-label">Decision-maker coverage</p>
        <p className="text-sm text-muted">{company.contactSummary.totalLabel}</p>
      </div>
      <div className="mt-5 space-y-4">
        {company.contacts.length > 0 ? (
          company.contacts.map((contact) => (
            <div key={contact.id} className="surface-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
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
                    <p className="mt-2 break-all text-sm text-copy">{contact.email}</p>
                  ) : null}
                  {contact.phone ? (
                    <p className="mt-1 text-sm text-muted">{contact.phone}</p>
                  ) : null}
                </div>
                <div className="text-left xl:text-right">
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

              <p className="mt-4 break-words text-sm leading-6 text-muted">
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
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.92fr)]">
      <div className="space-y-5">
        <WebsiteDiscoveryCard company={company} />
        <RecentReviewsCard company={company} maxItems={2} compactList />
      </div>
      <div className="space-y-5">
        <RecommendedContactCard company={company} />
        <OutreachPlanCard company={company} />
      </div>
    </div>
  );
}

function WebsiteSection({
  company,
}: Readonly<{
  company: CompanyDetailView;
}>) {
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
      <div className="space-y-5">
        <WebsiteDiscoveryCard company={company} />
        <ProviderTransparencyCard company={company} />
      </div>
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
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
      <RecentReviewsCard company={company} maxItems={4} />
      <div className="space-y-5">
        <PainsNotesCard company={company} />
        <FitReputationCard company={company} />
      </div>
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
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.92fr)]">
        <RecommendedContactCard company={company} showRanking />
        <OutreachPlanCard company={company} showCampaignSummary={false} />
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
        description="Pick a company from the queue to open its website, contact, review, and readiness workspace."
      >
        <EmptyState
          eyebrow="Company detail"
          title="Select a company to inspect it"
          description="The center workspace turns the chosen account into the dominant task object so deeper context stays calm, readable, and easy to act on."
        />
      </SectionCard>
    );
  }

  const showFullProfile = !sectionLinks?.length;

  return (
    <SectionCard
      title={company.companyName}
      description={`${company.market} • ${company.subindustry} • ${company.icpLabel}`}
      action={
        sectionLinks?.length ? (
          <Link
            href={`/companies?companyId=${company.companyId}`}
            className="button-secondary"
          >
            Open full company page
          </Link>
        ) : undefined
      }
      contentClassName="space-y-6"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.95fr)]">
        <div className="surface-elevated p-6 lg:p-7">
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

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.95fr)]">
            <div className="space-y-5">
              <div>
                <p className="micro-label">Operator brief</p>
                <p className="mt-3 text-[1.18rem] font-semibold leading-8 tracking-[-0.02em] text-copy">
                  {company.reviewSnapshot}
                </p>
                <p className="mt-4 text-sm leading-7 text-muted">
                  {company.suggestedNextAction}
                </p>
              </div>

              <div className="surface-soft p-5">
                <p className="micro-label">Recommended angle</p>
                <p className="mt-3 text-sm font-medium text-copy">
                  {company.outreachAngle.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {company.outreachAngle.reason}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <MetaItem
                label="Official website"
                value={
                  company.websiteDiscovery.officialWebsite ??
                  company.websiteDiscovery.candidate
                }
              />
              <MetaItem
                label="Primary contact"
                value={company.topRecommendedContact.label}
              />
              <MetaItem
                label="Recommended offer"
                value={company.recommendedOffer.name}
              />
              <MetaItem
                label="Current campaign"
                value={company.campaignSummary[0] ?? "No active campaign"}
              />
            </div>
          </div>
        </div>

        <div className="surface-muted p-6">
          <p className="micro-label">Readiness board</p>
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

          <div className="surface-soft mt-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={company.reviewContext.badge.label}
                tone={company.reviewContext.badge.tone}
              />
              <p className="text-sm text-muted">{company.reviewContext.metaLabel}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-copy">
              {company.reviewContext.summary}
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <p className="micro-label">Campaign context</p>
            {company.campaignSummary.map((item) => (
              <p key={item} className="text-sm leading-6 text-muted">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <ProfileSectionTabs links={sectionLinks} />

      {showFullProfile ? (
        <div className="space-y-8">
          <OverviewSection company={company} />
          <WebsiteSection company={company} />
          <ReviewsSection company={company} />
          <ContactsSection company={company} />
        </div>
      ) : null}
      {!showFullProfile && section === "overview" ? (
        <OverviewSection company={company} />
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
    </SectionCard>
  );
}
