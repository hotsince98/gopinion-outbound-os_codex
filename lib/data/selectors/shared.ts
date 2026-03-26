import { initialIcpProfiles } from "@/lib/data/config/icp";
import { priorityTierDefinitions } from "@/lib/data/config/priority-tiers";
import {
  deriveWorkflowState,
  getCompanyBundle,
  hasAnyContactPath,
  hasWebsiteCandidate,
  isContactCampaignEligible,
  listCompanyBundles,
  type CompanyBundle,
  type WorkflowState,
} from "@/lib/data/company/workflow";
import type {
  Company,
  Contact,
  PriorityTier,
} from "@/lib/domain";
import type { Tone } from "@/lib/presentation";

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsInput = Record<string, SearchParamValue>;

export type EnrichmentState =
  | "needs_enrichment"
  | "enriched"
  | "ready"
  | "blocked";

export interface WorkspaceStat {
  label: string;
  value: string;
  detail: string;
  change?: string;
  tone?: "neutral" | "positive" | "warning";
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface SelectorBadge {
  label: string;
  tone: Tone;
}

export {
  deriveWorkflowState,
  getCompanyBundle,
  hasAnyContactPath,
  hasWebsiteCandidate,
  isContactCampaignEligible,
  listCompanyBundles,
};
export type { CompanyBundle, WorkflowState };

const icpById = new Map(initialIcpProfiles.map((profile) => [profile.id, profile]));

export function readSearchParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function cleanQuery(query: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value.trim().length > 0),
  );
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatPriorityLabel(tier: PriorityTier) {
  switch (tier) {
    case "tier_1":
      return "Dream / Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Avoid / Tier 3";
  }
}

export function getPriorityBadge(tier: PriorityTier): SelectorBadge {
  switch (tier) {
    case "tier_1":
      return { label: "Dream / Tier 1", tone: "success" };
    case "tier_2":
      return { label: "Tier 2", tone: "accent" };
    case "tier_3":
      return { label: "Avoid / Tier 3", tone: "danger" };
  }
}

export function getCompanyStatusBadge(status: Company["status"]): SelectorBadge {
  switch (status) {
    case "new":
      return { label: "New", tone: "warning" };
    case "enriched":
      return { label: "Enriched", tone: "accent" };
    case "qualified":
      return { label: "Qualified", tone: "success" };
    case "campaign_ready":
      return { label: "Campaign ready", tone: "success" };
    case "customer":
      return { label: "Customer", tone: "accent" };
    case "disqualified":
      return { label: "Disqualified", tone: "danger" };
  }
}

export function deriveEnrichmentState(company: Company): EnrichmentState {
  switch (company.status) {
    case "new":
      return "needs_enrichment";
    case "enriched":
      return "enriched";
    case "qualified":
    case "campaign_ready":
    case "customer":
      return "ready";
    case "disqualified":
      return "blocked";
  }
}

export function getEnrichmentBadge(state: EnrichmentState): SelectorBadge {
  switch (state) {
    case "needs_enrichment":
      return { label: "Needs enrichment", tone: "warning" };
    case "enriched":
      return { label: "Enriched", tone: "accent" };
    case "ready":
      return { label: "Ready", tone: "success" };
    case "blocked":
      return { label: "Blocked", tone: "danger" };
  }
}

export function getEnrichmentConfidenceBadge(company: Company): SelectorBadge {
  switch (company.enrichment?.confidenceLevel ?? "none") {
    case "high":
      return { label: "High confidence", tone: "success" };
    case "medium":
      return { label: "Medium confidence", tone: "accent" };
    case "low":
      return { label: "Low confidence", tone: "warning" };
    case "none":
      return { label: "Confidence pending", tone: "muted" };
  }
}

export function getEnrichmentSummary(company: Company) {
  const discovery = company.enrichment?.websiteDiscovery;
  const supportingPageCount =
    (discovery?.staffPageUrls.length ?? 0) + (discovery?.contactPageUrls.length ?? 0);

  if (company.enrichment?.lastError) {
    return `Fetch issue: ${company.enrichment.lastError}`;
  }

  if (discovery?.extractedEvidence.length) {
    return discovery.extractedEvidence.slice(0, 2).join(" • ");
  }

  if (company.enrichment?.foundNames.length) {
    return `${company.enrichment.foundNames.length} named contact clue${
      company.enrichment.foundNames.length === 1 ? "" : "s"
    } found`;
  }

  if (supportingPageCount > 0) {
    return `${supportingPageCount} supporting public page${
      supportingPageCount === 1 ? "" : "s"
    } found`;
  }

  if (
    discovery?.status === "discovered" &&
    (company.enrichment?.sourceUrls.length ?? 0) === 0
  ) {
    return `Website discovered: ${discovery.discoveredWebsite ?? "verification pending"}`;
  }

  if (company.enrichment?.foundEmails.length) {
    return `${company.enrichment.foundEmails.length} email path${
      company.enrichment.foundEmails.length === 1 ? "" : "s"
    } found`;
  }

  if (company.enrichment?.foundPhones.length) {
    return `${company.enrichment.foundPhones.length} phone path${
      company.enrichment.foundPhones.length === 1 ? "" : "s"
    } found`;
  }

  if (company.enrichment?.sourceUrls.length) {
    return `${company.enrichment.sourceUrls.length} public page${
      company.enrichment.sourceUrls.length === 1 ? "" : "s"
    } scanned`;
  }

  if (company.enrichment?.noteHints.length) {
    return `${company.enrichment.noteHints.length} structured note hint${
      company.enrichment.noteHints.length === 1 ? "" : "s"
    } parsed`;
  }

  return "No enrichment run yet";
}

export function getMissingFieldsLabel(company: Company) {
  if (!company.enrichment?.missingFields.length) {
    return "Nothing critical missing";
  }

  return `Missing: ${company.enrichment.missingFields.slice(0, 3).join(", ")}`;
}

export function getLastEnrichedLabel(company: Company) {
  if (!company.enrichment?.lastEnrichedAt) {
    if (company.enrichment?.lastAttemptedAt) {
      return `Last attempted ${new Date(company.enrichment.lastAttemptedAt).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        },
      )}`;
    }

    return "Not enriched yet";
  }

  return `Last enriched ${new Date(company.enrichment.lastEnrichedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  )}`;
}

export function getImportDateLabel(company: Company) {
  return `Imported ${new Date(company.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export function getWebsiteDiscoveryLabel(company: Company) {
  const discovery = company.enrichment?.websiteDiscovery;
  const supportingDetails = [
    (discovery?.staffPageUrls.length ?? 0) > 0
      ? `${discovery?.staffPageUrls.length} staff/team`
      : undefined,
    (discovery?.contactPageUrls.length ?? 0) > 0
      ? `${discovery?.contactPageUrls.length} contact`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" • ");
  const evidence = discovery?.extractedEvidence[0];

  if (!discovery) {
    return hasWebsiteCandidate(company)
      ? `Website on record: ${company.presence.websiteUrl ?? company.enrichment?.websiteDiscovery?.discoveredWebsite ?? "pending verification"}`
      : "Website discovery not started";
  }

  switch (discovery.status) {
    case "record_provided":
      return [
        `Website on record: ${discovery.discoveredWebsite ?? company.presence.websiteUrl ?? "pending verification"}`,
        supportingDetails,
        evidence,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ");
    case "discovered":
      return [
        `Discovered website: ${discovery.discoveredWebsite ?? "verification pending"}`,
        supportingDetails,
        evidence,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ");
    case "not_found":
      return "Discovery could not find a confident site";
    case "failed":
      return discovery.lastError
        ? `Discovery failed: ${discovery.lastError}`
        : "Discovery failed";
    case "not_checked":
    default:
      return "Website discovery not started";
  }
}

export function getPreferredSupportingPage(company: Company) {
  return company.enrichment?.websiteDiscovery?.preferredSupportingPage;
}

export function getPreferredSupportingPageLabel(company: Company) {
  const preferredPage = getPreferredSupportingPage(company);

  if (!preferredPage) {
    return "No preferred supporting page saved yet";
  }

  return `${preferredPage.kind.replaceAll("_", " ")} page: ${preferredPage.url}`;
}

export function getPreferredSupportingPageSourceLabel(company: Company) {
  const preferredPage = getPreferredSupportingPage(company);

  if (!preferredPage) {
    return "Preferred-page source pending";
  }

  return preferredPage.source === "operator_confirmed"
    ? "Operator confirmed"
    : "Auto-discovered";
}

export function getNoteHintSummary(company: Company) {
  const noteHints = company.enrichment?.noteHints ?? [];

  if (noteHints.length === 0) {
    return "No parsed note hints";
  }

  const contacts = noteHints.filter((hint) => hint.kind === "contact_name").length;
  const emails = noteHints.filter((hint) => hint.kind === "email").length;
  const phones = noteHints.filter((hint) => hint.kind === "phone").length;
  const observations = noteHints.filter((hint) => hint.kind === "observation").length;

  return [
    contacts > 0 ? `${contacts} contact hint${contacts === 1 ? "" : "s"}` : undefined,
    emails > 0 ? `${emails} email hint${emails === 1 ? "" : "s"}` : undefined,
    phones > 0 ? `${phones} phone hint${phones === 1 ? "" : "s"}` : undefined,
    observations > 0
      ? `${observations} operator note${observations === 1 ? "" : "s"}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" • ");
}

export function getSegmentLabel(company: Company) {
  return company.enrichment?.segment?.label ?? "Segment pending";
}

export function getSegmentAngle(company: Company) {
  return (
    company.enrichment?.segment?.angle ??
    "Angle will sharpen after discovery, enrichment, and operator review."
  );
}

export function getOutreachAngleLabel(company: Company) {
  return company.enrichment?.outreachAngle?.label ?? "Angle pending";
}

export function getOutreachAngleReason(company: Company) {
  return (
    company.enrichment?.outreachAngle?.shortReason ??
    "Angle will sharpen after website discovery, enrichment, and operator review."
  );
}

export function getOutreachAngleUrgencyBadge(company: Company): SelectorBadge {
  switch (company.enrichment?.outreachAngle?.urgency) {
    case "high":
      return { label: "High urgency", tone: "warning" };
    case "medium":
      return { label: "Medium urgency", tone: "accent" };
    case "low":
      return { label: "Low urgency", tone: "muted" };
    default:
      return { label: "Urgency pending", tone: "muted" };
  }
}

export function getOutreachAngleConfidenceBadge(company: Company): SelectorBadge {
  switch (company.enrichment?.outreachAngle?.confidenceLevel) {
    case "high":
      return { label: "High angle confidence", tone: "success" };
    case "medium":
      return { label: "Medium angle confidence", tone: "accent" };
    case "low":
      return { label: "Low angle confidence", tone: "warning" };
    case "none":
    default:
      return { label: "Angle confidence pending", tone: "muted" };
  }
}

export function getOutreachAngleReviewPathBadge(company: Company): SelectorBadge {
  switch (company.enrichment?.outreachAngle?.reviewPath) {
    case "campaign_review":
      return { label: "Campaign review", tone: "success" };
    case "manual_review":
      return { label: "Manual review", tone: "warning" };
    default:
      return { label: "Review path pending", tone: "muted" };
  }
}

export function getOutreachAngleOfferId(company: Company) {
  return company.enrichment?.outreachAngle?.recommendedFirstOfferId;
}

export function getSourceLabel(company: Company) {
  return `${company.source.label ?? formatLabel(company.source.kind)} • ${formatLabel(company.source.provider)}`;
}

export function getWorkflowBadge(state: WorkflowState): SelectorBadge {
  switch (state) {
    case "ready":
      return { label: "Ready", tone: "success" };
    case "needs_enrichment":
      return { label: "Needs enrichment", tone: "warning" };
    case "needs_review":
      return { label: "Needs review", tone: "accent" };
    case "blocked":
      return { label: "Blocked", tone: "danger" };
  }
}

export function getIndustryLabel(company: Company) {
  if (company.subindustry) {
    return company.subindustry;
  }

  return company.isIndependent
    ? "Independent used car dealer"
    : "Dealer group / out of scope";
}

export function getIcpLabel(company: Company) {
  return icpById.get(company.icpProfileId)?.name ?? "Unassigned ICP";
}

export function getReviewSnapshot(company: Company) {
  const rating = company.presence.googleRating;
  const reviews = company.presence.reviewCount;
  const response = formatLabel(company.presence.reviewResponseBand);

  if (rating == null || reviews == null) {
    return "Review profile incomplete";
  }

  return `${rating.toFixed(1)}★ • ${reviews} reviews • ${response}`;
}

export function formatRoleLabel(contact: Contact) {
  return contact.title ?? formatLabel(contact.role);
}

export function getContactQualityLabel(contact: Contact | undefined) {
  if (!contact) {
    return "Quality pending";
  }

  switch (contact.quality?.qualityTier) {
    case "strong":
      return "Strong contact path";
    case "usable":
      return "Usable contact path";
    case "weak":
      return "Weak contact path";
    case "junk":
      return "Low-quality contact path";
    default:
      return `Confidence ${contact.confidence.score.toFixed(2)}`;
  }
}

export function getContactSourceLabel(contact: Contact | undefined) {
  if (!contact) {
    return "Source pending";
  }

  return `${contact.source.label ?? contact.source.provider} • ${contact.source.kind}`;
}

export function getContactWarnings(contact: Contact | undefined) {
  return contact?.quality?.warnings ?? [];
}

export function getPrimaryContactSelectionReason(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    if (bundle.company.enrichment?.websiteDiscovery?.preferredSupportingPage?.reason) {
      return bundle.company.enrichment.websiteDiscovery.preferredSupportingPage.reason;
    }

    return "A primary outreach contact has not been selected yet.";
  }

  return (
    bundle.primaryContact.quality?.selectionReasons[0] ??
    bundle.primaryContact.confidence.signals[0] ??
    "This contact currently ranks highest for outreach."
  );
}

export function getContactCoverageLabel(bundle: CompanyBundle) {
  const count = bundle.contacts.length;

  if (count === 0) {
    if (bundle.company.enrichment?.contactPath === "role_inbox") {
      return "Role inbox detected • contact record pending";
    }

    if (bundle.company.enrichment?.foundPhones[0] || bundle.company.presence.primaryPhone) {
      return "Phone path detected • contact record pending";
    }

    return "0 contacts";
  }

  if (!bundle.primaryContact) {
    return `${count} contact${count === 1 ? "" : "s"} • no primary`;
  }

  if (bundle.primaryContact.quality?.pathKind === "phone_only") {
    return `${count} contact${count === 1 ? "" : "s"} • phone fallback only`;
  }

  if (isContactCampaignEligible(bundle.primaryContact) && !bundle.primaryContact.fullName) {
    return `${count} contact${count === 1 ? "" : "s"} • exact-domain inbox ready`;
  }

  if (!isContactCampaignEligible(bundle.primaryContact)) {
    return `${count} contact${count === 1 ? "" : "s"} • review contact quality`;
  }

  return `${count} contact${count === 1 ? "" : "s"} • ${formatRoleLabel(
    bundle.primaryContact,
  )}`;
}

export function getDecisionMakerLabel(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    if (bundle.company.enrichment?.foundEmails[0]) {
      return `${bundle.company.enrichment.foundEmails[0]} • role inbox`;
    }

    if (bundle.company.enrichment?.foundPhones[0] || bundle.company.presence.primaryPhone) {
      return `${bundle.company.enrichment?.foundPhones[0] ?? bundle.company.presence.primaryPhone} • phone fallback`;
    }

    return "No likely decision-maker yet";
  }

  const name =
    bundle.primaryContact.fullName ??
    bundle.primaryContact.email ??
    bundle.primaryContact.phone ??
    "Primary contact";

  return `${name} • ${formatRoleLabel(bundle.primaryContact)}`;
}

export function getDecisionMakerConfidenceLabel(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    if (bundle.company.enrichment?.confidenceLevel) {
      return `${formatLabel(bundle.company.enrichment.confidenceLevel)} confidence`;
    }

    return "Confidence pending";
  }

  return getContactQualityLabel(bundle.primaryContact);
}

export function getPrimaryContactReadinessReason(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    return "No primary outreach contact has been selected yet";
  }

  if (isContactCampaignEligible(bundle.primaryContact)) {
    return bundle.primaryContact.fullName
      ? "Ready because a named company-domain contact was selected"
      : "Ready because an exact-domain business inbox was selected";
  }

  return (
    bundle.primaryContact.quality?.warnings[0] ??
    bundle.company.enrichment?.lastError ??
    "Needs review because the best available contact path is still weak"
  );
}

export function getWorkflowReason(bundle: CompanyBundle) {
  const workflowState = deriveWorkflowState(bundle);

  if (workflowState === "blocked") {
    if (
      bundle.company.status === "disqualified" ||
      bundle.company.disqualifierSignals.length > 0
    ) {
      return (
        bundle.company.disqualifierSignals[0] ??
        "This lead is blocked by an explicit disqualifier signal."
      );
    }

    return "Still blocked because no website, phone, or primary outreach path has been verified yet.";
  }

  if (workflowState === "needs_enrichment") {
    if (!hasWebsiteCandidate(bundle.company)) {
      return "Needs enrichment because no verified website is on record yet.";
    }

    return "Needs enrichment because the record still needs stronger public-web coverage.";
  }

  if (workflowState === "needs_review") {
    if (!bundle.primaryContact) {
      return "Needs review because a primary outreach contact has not been selected yet.";
    }

    if (!isContactCampaignEligible(bundle.primaryContact)) {
      return (
        bundle.primaryContact.quality?.warnings[0] ??
        "Needs review because the best available contact path is still weak."
      );
    }

    if (bundle.company.enrichment?.manualReviewRequired) {
      return "Needs review because enrichment found a path forward, but operator verification is still recommended.";
    }
  }

  return getPrimaryContactReadinessReason(bundle);
}

export function getCampaignStatusLabel(bundle: CompanyBundle) {
  if (bundle.activeCampaigns.length === 0) {
    return "No active campaign";
  }

  const activeCampaign = bundle.activeCampaigns[0];

  return `${formatLabel(activeCampaign.status)} • ${activeCampaign.name}`;
}

export function getRecommendedOfferName(bundle: CompanyBundle) {
  return bundle.recommendedOffer?.name ?? "Offer pending";
}

export function getSuggestedNextAction(bundle: CompanyBundle) {
  const workflowState = deriveWorkflowState(bundle);
  const outreachAngle = bundle.company.enrichment?.outreachAngle;

  if (
    bundle.company.status === "disqualified" ||
    bundle.company.disqualifierSignals.length > 0
  ) {
    return "Suppress for now or revisit if better signals appear";
  }

  if (workflowState === "blocked") {
    return outreachAngle
      ? `Manually verify the website, phone, or source record before using the ${outreachAngle.label.toLowerCase()} angle`
      : "Manually verify the website, phone, or source record before campaign review";
  }

  if (workflowState === "needs_enrichment") {
    return hasWebsiteCandidate(bundle.company)
      ? outreachAngle
        ? `Run enrichment and confirm the ${outreachAngle.label.toLowerCase()} angle from the public site`
        : "Run enrichment and confirm the best outreach path from the public site"
      : "Run website discovery, then enrich the company profile";
  }

  if (bundle.company.enrichment?.manualReviewRequired) {
    return outreachAngle
      ? `Review the ${outreachAngle.label.toLowerCase()} angle and verify the contact path`
      : "Review the enrichment findings and verify the contact path";
  }

  if (bundle.company.status === "enriched") {
    return "Review fit signals and promote to qualified if ready";
  }

  if (!bundle.primaryContact) {
    return "Identify the most likely owner or GM";
  }

  if (!isContactCampaignEligible(bundle.primaryContact)) {
    return "Verify the contact before enrolling into outreach";
  }

  if (bundle.latestReply?.classification === "objection") {
    return "Review the objection and refine the CTA";
  }

  if (bundle.latestReply?.classification === "not_now") {
    return "Schedule a later follow-up rather than pushing now";
  }

  if (bundle.company.status === "campaign_ready" && bundle.activeCampaigns.length === 0) {
    return outreachAngle
      ? `Move into campaign review using the ${outreachAngle.label.toLowerCase()} angle`
      : "Enroll into the best-fit campaign";
  }

  if (bundle.company.status === "qualified") {
    return "Validate the offer angle and prep outreach";
  }

  return "Monitor the account and keep progression visible";
}

export function matchesSearch(bundle: CompanyBundle, search: string) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  const haystack = [
    bundle.company.name,
    bundle.company.location.city,
    bundle.company.location.state,
    bundle.company.location.country,
    getIndustryLabel(bundle.company),
    bundle.company.subindustry ?? "",
    getIcpLabel(bundle.company),
    bundle.company.presence.websiteUrl ?? "",
    bundle.company.enrichment?.websiteDiscovery?.discoveredWebsite ?? "",
    (bundle.company.notes ?? []).join(" "),
    (bundle.company.enrichment?.noteHints ?? []).map((hint) => hint.value).join(" "),
    bundle.company.enrichment?.segment?.label ?? "",
    bundle.company.enrichment?.segment?.angle ?? "",
    bundle.company.enrichment?.outreachAngle?.label ?? "",
    bundle.company.enrichment?.outreachAngle?.shortReason ?? "",
    (bundle.company.enrichment?.outreachAngle?.reasons ?? []).join(" "),
    getSourceLabel(bundle.company),
    bundle.recommendedOffer?.name ?? "",
    bundle.primaryContact?.fullName ?? "",
    bundle.primaryContact?.title ?? "",
    bundle.primaryContact?.email ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

export function makeCountedOptions(
  options: Array<{ value: string; label: string }>,
  countForValue: (value: string) => number,
): FilterOption[] {
  return options.map((option) => ({
    ...option,
    count: countForValue(option.value),
  }));
}

export function getIcpFilterOptions(bundles: CompanyBundle[]): FilterOption[] {
  return makeCountedOptions(
    [
      { value: "all", label: "All ICPs" },
      ...initialIcpProfiles.map((profile) => ({
        value: profile.id,
        label: profile.name,
      })),
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) => bundle.company.icpProfileId === value).length,
  );
}

export function getTierFilterOptions(bundles: CompanyBundle[]): FilterOption[] {
  return makeCountedOptions(
    [
      { value: "all", label: "All tiers" },
      ...priorityTierDefinitions.map((definition) => ({
        value: definition.tier,
        label: formatPriorityLabel(definition.tier),
      })),
    ],
    (value) =>
      value === "all"
        ? bundles.length
        : bundles.filter((bundle) => bundle.company.priorityTier === value).length,
  );
}
