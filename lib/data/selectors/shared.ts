import { initialIcpProfiles } from "@/lib/data/config/icp";
import { priorityTierDefinitions } from "@/lib/data/config/priority-tiers";
import type {
  Appointment,
  Campaign,
  Company,
  Contact,
  Enrollment,
  IcpProfile,
  Offer,
  PriorityTier,
  Reply,
} from "@/lib/domain";
import type { Tone } from "@/lib/presentation";
import { buildIdMap, type SelectorDataSnapshot } from "@/lib/data/selectors/snapshot";

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsInput = Record<string, SearchParamValue>;

export type EnrichmentState =
  | "needs_enrichment"
  | "enriched"
  | "ready"
  | "blocked";

export type WorkflowState =
  | "ready"
  | "needs_enrichment"
  | "needs_review"
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

export interface CompanyBundle {
  company: Company;
  icpProfile?: IcpProfile;
  contacts: Contact[];
  primaryContact?: Contact;
  recommendedOffer?: Offer;
  activeCampaigns: Campaign[];
  enrollments: Enrollment[];
  latestReply?: Reply;
  appointments: Appointment[];
}

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

export function deriveWorkflowState(bundle: CompanyBundle): WorkflowState {
  if (
    bundle.company.status === "disqualified" ||
    bundle.company.disqualifierSignals.length > 0 ||
    bundle.company.priorityTier === "tier_3"
  ) {
    return "blocked";
  }

  if (bundle.company.status === "new") {
    return "needs_enrichment";
  }

  if (
    bundle.company.status === "enriched" ||
    !bundle.primaryContact ||
    !bundle.primaryContact.outreachReady ||
    bundle.primaryContact.status === "candidate"
  ) {
    return "needs_review";
  }

  return "ready";
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

export function getContactCoverageLabel(bundle: CompanyBundle) {
  const count = bundle.contacts.length;

  if (count === 0) {
    return "0 contacts";
  }

  if (!bundle.primaryContact) {
    return `${count} contact${count === 1 ? "" : "s"} • no primary`;
  }

  return `${count} contact${count === 1 ? "" : "s"} • ${formatRoleLabel(
    bundle.primaryContact,
  )}`;
}

export function getDecisionMakerLabel(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    return "No likely decision-maker yet";
  }

  const name = bundle.primaryContact.fullName ?? "Primary contact";

  return `${name} • ${formatRoleLabel(bundle.primaryContact)}`;
}

export function getDecisionMakerConfidenceLabel(bundle: CompanyBundle) {
  if (!bundle.primaryContact) {
    return "Confidence pending";
  }

  return `Confidence ${bundle.primaryContact.confidence.score.toFixed(2)}`;
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

  if (workflowState === "blocked") {
    return "Suppress for now or revisit if better signals appear";
  }

  if (workflowState === "needs_enrichment") {
    return "Run enrichment and source an initial decision-maker hypothesis";
  }

  if (bundle.company.status === "enriched") {
    return "Review fit signals and promote to qualified if ready";
  }

  if (!bundle.primaryContact) {
    return "Identify the most likely owner or GM";
  }

  if (bundle.primaryContact.status === "candidate") {
    return "Verify the contact before enrolling into outreach";
  }

  if (bundle.latestReply?.classification === "objection") {
    return "Review the objection and refine the CTA";
  }

  if (bundle.latestReply?.classification === "not_now") {
    return "Schedule a later follow-up rather than pushing now";
  }

  if (bundle.company.status === "campaign_ready" && bundle.activeCampaigns.length === 0) {
    return "Enroll into the best-fit campaign";
  }

  if (bundle.company.status === "qualified") {
    return "Validate the offer angle and prep outreach";
  }

  return "Monitor the account and keep progression visible";
}

function createSnapshotLookups(snapshot: SelectorDataSnapshot) {
  return {
    offerById: buildIdMap(snapshot.offers),
    campaignById: buildIdMap(snapshot.campaigns),
    appointmentById: buildIdMap(snapshot.appointments),
  };
}

export function getCompanyBundle(
  company: Company,
  snapshot: SelectorDataSnapshot,
  lookups = createSnapshotLookups(snapshot),
): CompanyBundle {
  const contacts = snapshot.contacts.filter((contact) => contact.companyId === company.id);
  const recommendedOffer = company.recommendedOfferIds
    .map((offerId) => lookups.offerById.get(offerId))
    .find(Boolean);
  const activeCampaigns = company.activeCampaignIds
    .map((campaignId) => lookups.campaignById.get(campaignId))
    .filter((campaign): campaign is Campaign => Boolean(campaign));
  const enrollments = snapshot.enrollments.filter(
    (enrollment) => enrollment.companyId === company.id,
  );
  const latestReply = snapshot.replies
    .filter((reply) => reply.companyId === company.id)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))[0];
  const appointments = company.appointmentIds
    .map((appointmentId) => lookups.appointmentById.get(appointmentId))
    .filter((appointment): appointment is Appointment => Boolean(appointment));

  return {
    company,
    icpProfile: icpById.get(company.icpProfileId),
    contacts,
    primaryContact: company.primaryContactId
      ? contacts.find((contact) => contact.id === company.primaryContactId)
      : contacts.find((contact) => contact.isPrimary),
    recommendedOffer,
    activeCampaigns,
    enrollments,
    latestReply,
    appointments,
  };
}

export function listCompanyBundles(snapshot: SelectorDataSnapshot) {
  const lookups = createSnapshotLookups(snapshot);

  return snapshot.companies.map((company) => getCompanyBundle(company, snapshot, lookups));
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
    (bundle.company.notes ?? []).join(" "),
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
