import { initialOffers } from "@/lib/data/config/offers";
import type {
  Company,
  CompanyOutreachAngleSnapshot,
  CompanySegmentSnapshot,
  Contact,
  EnrichmentConfidenceLevel,
  OfferId,
} from "@/lib/domain";

const frontDoorOffer =
  initialOffers.find((offer) => offer.isPrimaryFrontDoor) ?? initialOffers[0];
const operationalOffer =
  initialOffers.find((offer) => offer.id === "offer_naps") ?? initialOffers[0];

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getConfidenceLevel(score: number): EnrichmentConfidenceLevel {
  if (score >= 84) {
    return "high";
  }

  if (score >= 66) {
    return "medium";
  }

  if (score >= 42) {
    return "low";
  }

  return "none";
}

function getSegmentConfidenceBonus(segment: CompanySegmentSnapshot | undefined) {
  switch (segment?.confidenceLevel) {
    case "high":
      return 18;
    case "medium":
      return 10;
    case "low":
      return 4;
    case "none":
    case undefined:
      return 0;
  }
}

function getUrgency(params: {
  key: CompanyOutreachAngleSnapshot["key"];
  rating?: number;
  reviewCount?: number;
  hasWebsite: boolean;
  hasClaimedGoogleBusinessProfile: boolean;
  reviewPath: CompanyOutreachAngleSnapshot["reviewPath"];
}) {
  const { key, rating, reviewCount, hasWebsite, hasClaimedGoogleBusinessProfile, reviewPath } =
    params;

  switch (key) {
    case "review_response_routing_issue":
      return reviewCount != null && reviewCount >= 40 ? "high" : "medium";
    case "review_growth_opportunity":
      return rating != null && rating <= 4.0
        ? "high"
        : reviewCount != null && reviewCount < 15
          ? "high"
          : reviewPath === "campaign_review"
            ? "medium"
            : "low";
    case "naps_listing_consistency_opportunity":
      return !hasWebsite || !hasClaimedGoogleBusinessProfile ? "high" : "medium";
    case "provider_replacement_opportunity":
      return reviewPath === "campaign_review" ? "high" : "medium";
    case "control_reporting_opportunity":
      return reviewPath === "campaign_review" ? "medium" : "low";
    case "strong_review_optimization_opportunity":
      return reviewPath === "campaign_review" ? "medium" : "low";
    case "generic_manual_review":
    default:
      return "low";
  }
}

export function prioritizeRecommendedOfferIds(
  recommendedFirstOfferId: OfferId,
  existingOfferIds: readonly OfferId[] | undefined,
) {
  return [
    recommendedFirstOfferId,
    ...((existingOfferIds ?? []).filter((offerId) => offerId !== recommendedFirstOfferId)),
  ] as OfferId[];
}

export function classifyCompanyOutreachAngle(params: {
  presence: Company["presence"];
  segment?: CompanySegmentSnapshot;
  primaryContact?: Contact;
  manualReviewRequired?: boolean;
  now: string;
}): CompanyOutreachAngleSnapshot {
  const { presence, segment, primaryContact, now } = params;
  const rating = presence.googleRating;
  const reviewCount = presence.reviewCount;
  const campaignEligible = primaryContact?.quality?.campaignEligible ?? false;
  const reviewPath: CompanyOutreachAngleSnapshot["reviewPath"] =
    campaignEligible && !params.manualReviewRequired
      ? "campaign_review"
      : "manual_review";
  const recommendedOperationalOfferId = operationalOffer.id;
  const recommendedFrontDoorOfferId = frontDoorOffer.id;
  let key: CompanyOutreachAngleSnapshot["key"] = "generic_manual_review";
  let label = "Generic manual review";
  let shortReason =
    "Signals are mixed enough that an operator should choose the motion before campaign review.";
  let recommendedFirstOfferId = recommendedFrontDoorOfferId;
  let reasons: string[] = [];

  if (!presence.hasWebsite || !presence.hasClaimedGoogleBusinessProfile) {
    key = "naps_listing_consistency_opportunity";
    label = "NAPS / listing consistency opportunity";
    shortReason =
      "Foundational website or listing consistency gaps come before a heavier reviews pitch.";
    recommendedFirstOfferId = recommendedOperationalOfferId;
    reasons = dedupeStrings([
      !presence.hasWebsite
        ? "Website coverage is still missing or unverified"
        : undefined,
      !presence.hasClaimedGoogleBusinessProfile
        ? "Google Business Profile coverage still looks incomplete"
        : undefined,
      "Listing and local-presence consistency is the clearest front-door motion",
    ]);
  } else if (segment?.key === "provider_replacement") {
    key = "provider_replacement_opportunity";
    label = "Provider replacement opportunity";
    shortReason =
      "The business looks mature enough for a cleaner replacement or consolidation motion.";
    recommendedFirstOfferId = recommendedOperationalOfferId;
    reasons = dedupeStrings([
      ...segment.reasons,
      campaignEligible
        ? "A usable outreach path exists for a more direct operator conversation"
        : "The angle is clear, but contact review still matters before campaign assignment",
    ]);
  } else if (segment?.key === "control_reporting") {
    key = "control_reporting_opportunity";
    label = "Control / reporting opportunity";
    shortReason =
      "The review profile is already credible, so visibility and control beat a rescue pitch.";
    recommendedFirstOfferId = recommendedOperationalOfferId;
    reasons = dedupeStrings([
      ...segment.reasons,
      "Lead with operator reporting, response control, and less spreadsheet work",
    ]);
  } else if (
    ["none", "low", "inconsistent"].includes(presence.reviewResponseBand) &&
    (reviewCount ?? 0) >= 25
  ) {
    key = "review_response_routing_issue";
    label = "Review response / routing issue";
    shortReason =
      "The store has enough review activity that inconsistent response behavior is visible and urgent.";
    recommendedFirstOfferId = recommendedFrontDoorOfferId;
    reasons = dedupeStrings([
      presence.reviewResponseBand === "none"
        ? "Reviews are visible, but response coverage appears absent"
        : "Reviews are visible, but response coverage appears inconsistent",
      reviewCount != null ? `${reviewCount} reviews already create public routing pressure` : undefined,
      rating != null && rating < 4.2
        ? "The current rating leaves trust on the table"
        : undefined,
    ]);
  } else if (
    rating != null &&
    reviewCount != null &&
    rating >= 4.2 &&
    reviewCount >= 35
  ) {
    key = "strong_review_optimization_opportunity";
    label = "Strong review profile but optimization opportunity";
    shortReason =
      "This business should stay targetable under an optimization angle rather than being treated like a reputation rescue.";
    recommendedFirstOfferId = recommendedFrontDoorOfferId;
    reasons = dedupeStrings([
      "The review profile is already strong enough for an optimization-first motion",
      segment?.key === "strong_review_profile"
        ? "Existing segmentation already points away from a rescue narrative"
        : undefined,
      campaignEligible
        ? "A usable contact path exists to take this into campaign review quickly"
        : "The angle is good, but operator review still needs to confirm the contact path",
    ]);
  } else if (
    rating == null ||
    reviewCount == null ||
    reviewCount < 35 ||
    rating < 4.2
  ) {
    key = "review_growth_opportunity";
    label = "Review growth opportunity";
    shortReason =
      "Review volume or rating posture still leaves visible room to grow trust and social proof.";
    recommendedFirstOfferId = recommendedFrontDoorOfferId;
    reasons = dedupeStrings([
      reviewCount == null
        ? "Review volume still needs verification"
        : reviewCount < 20
          ? "Review volume is still relatively light"
          : "Review posture still leaves room to grow public trust",
      rating != null && rating < 4.2
        ? `Current rating (${rating.toFixed(1)}) leaves room for visible improvement`
        : undefined,
      "A reviews-first motion is still the clearest opening",
    ]);
  }

  const confidenceScore = clampScore(
    34 +
      getSegmentConfidenceBonus(segment) +
      (presence.hasWebsite ? 10 : 0) +
      (presence.hasClaimedGoogleBusinessProfile ? 8 : 0) +
      (rating != null ? 8 : 0) +
      (reviewCount != null ? 8 : 0) +
      (primaryContact ? 10 : 0) +
      (campaignEligible ? 8 : 0) +
      (params.manualReviewRequired ? -6 : 0) +
      (key === "generic_manual_review" ? -12 : 0),
  );

  return {
    key,
    label,
    shortReason,
    recommendedFirstOfferId,
    urgency: getUrgency({
      key,
      rating,
      reviewCount,
      hasWebsite: presence.hasWebsite,
      hasClaimedGoogleBusinessProfile: presence.hasClaimedGoogleBusinessProfile,
      reviewPath,
    }),
    confidenceLevel: getConfidenceLevel(confidenceScore),
    confidenceScore,
    reviewPath,
    reasons,
    updatedAt: now,
  };
}
