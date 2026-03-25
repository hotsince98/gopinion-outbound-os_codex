import {
  rankContactsForPrimarySelection,
  type RankedContactSelection,
} from "@/lib/data/contacts/quality";
import { buildIdMap, type SelectorDataSnapshot } from "@/lib/data/selectors/snapshot";
import type {
  Appointment,
  Campaign,
  Company,
  Contact,
  Enrollment,
  IcpProfile,
  Offer,
  Reply,
} from "@/lib/domain";

export type WorkflowState =
  | "ready"
  | "needs_enrichment"
  | "needs_review"
  | "blocked";

export interface CompanyBundle {
  company: Company;
  icpProfile?: IcpProfile;
  contacts: Contact[];
  rankedContacts: RankedContactSelection[];
  primaryContact?: Contact;
  recommendedOffer?: Offer;
  activeCampaigns: Campaign[];
  enrollments: Enrollment[];
  latestReply?: Reply;
  appointments: Appointment[];
}

function createSnapshotLookups(snapshot: SelectorDataSnapshot) {
  return {
    offerById: buildIdMap(snapshot.offers),
    campaignById: buildIdMap(snapshot.campaigns),
    appointmentById: buildIdMap(snapshot.appointments),
  };
}

export function hasWebsiteCandidate(company: Company) {
  return Boolean(
    company.presence.websiteUrl ??
      company.enrichment?.websiteDiscovery?.discoveredWebsite,
  );
}

export function hasAnyContactPath(bundle: CompanyBundle) {
  return Boolean(
    bundle.contacts.some((contact) => Boolean(contact.email || contact.phone)) ||
      bundle.company.presence.primaryPhone ||
      bundle.company.enrichment?.foundEmails[0] ||
      bundle.company.enrichment?.foundPhones[0],
  );
}

export function isContactCampaignEligible(contact: Contact | undefined) {
  return contact?.quality?.campaignEligible ?? contact?.outreachReady ?? false;
}

export function deriveWorkflowState(bundle: CompanyBundle): WorkflowState {
  if (
    bundle.company.status === "disqualified" ||
    bundle.company.disqualifierSignals.length > 0
  ) {
    return "blocked";
  }

  const websiteCandidate = hasWebsiteCandidate(bundle.company);
  const anyContactPath = hasAnyContactPath(bundle);
  const discoveryStatus = bundle.company.enrichment?.websiteDiscovery?.status;
  const discoveryFailed =
    discoveryStatus === "failed" || discoveryStatus === "not_found";

  if (
    !websiteCandidate &&
    !anyContactPath &&
    discoveryFailed &&
    bundle.company.enrichment?.lastAttemptedAt
  ) {
    return "blocked";
  }

  if (bundle.company.status === "new" || !bundle.company.enrichment?.lastEnrichedAt) {
    return "needs_enrichment";
  }

  if (
    bundle.company.status === "enriched" ||
    !websiteCandidate ||
    !bundle.primaryContact ||
    !isContactCampaignEligible(bundle.primaryContact) ||
    bundle.primaryContact.status === "candidate" ||
    bundle.company.enrichment?.manualReviewRequired
  ) {
    return "needs_review";
  }

  return "ready";
}

export function getCompanyBundle(
  company: Company,
  snapshot: SelectorDataSnapshot,
  lookups = createSnapshotLookups(snapshot),
): CompanyBundle {
  const contacts = snapshot.contacts.filter((contact) => contact.companyId === company.id);
  const rankedContacts = rankContactsForPrimarySelection(contacts, {
    preferredContactId: company.primaryContactId,
  });
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
    contacts: rankedContacts.map((selection) => selection.contact),
    rankedContacts,
    primaryContact: rankedContacts.find((selection) => selection.isPrimary)?.contact,
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
