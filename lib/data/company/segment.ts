import type {
  Company,
  CompanySegmentSnapshot,
} from "@/lib/domain";

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

export function classifyCompanySegment(params: {
  presence: Company["presence"];
  softwareToolCountEstimate?: Company["softwareToolCountEstimate"];
  now: string;
}): CompanySegmentSnapshot {
  const { presence, softwareToolCountEstimate, now } = params;
  const rating = presence.googleRating;
  const reviewCount = presence.reviewCount;

  if (!presence.hasWebsite || !presence.hasClaimedGoogleBusinessProfile) {
    return {
      key: "naps_listing",
      label: "NAPS / listing opportunity",
      angle:
        "Lead with the missing website or local-presence foundation before pushing a heavier reviews motion.",
      reasons: dedupeStrings([
        !presence.hasWebsite ? "Website foundation is still missing" : undefined,
        !presence.hasClaimedGoogleBusinessProfile
          ? "Google Business Profile still needs work"
          : undefined,
      ]),
      confidenceLevel: "medium",
      updatedAt: now,
    };
  }

  if (
    rating != null &&
    reviewCount != null &&
    rating >= 4.4 &&
    reviewCount >= 90 &&
    (softwareToolCountEstimate ?? 0) >= 3
  ) {
    return {
      key: "provider_replacement",
      label: "Provider replacement opportunity",
      angle:
        "Lead with control, cleaner reporting, and replacing bloated reputation tooling rather than selling basic reviews pain.",
      reasons: [
        "Review profile is already strong enough for a replacement or consolidation angle",
        "Operational tooling suggests the account can evaluate provider tradeoffs",
      ],
      confidenceLevel: "high",
      updatedAt: now,
    };
  }

  if (rating != null && reviewCount != null && rating >= 4.5 && reviewCount >= 80) {
    return {
      key: "control_reporting",
      label: "Control / reporting opportunity",
      angle:
        "Lead with operator visibility, stronger response controls, and clearer reporting instead of assuming a reputation crisis.",
      reasons: [
        "Strong review profile should be optimized rather than discarded",
        "Visible trust signals are healthy enough to support a control/reporting angle",
      ],
      confidenceLevel: "high",
      updatedAt: now,
    };
  }

  if (rating != null && reviewCount != null && rating >= 4.2 && reviewCount >= 35) {
    return {
      key: "strong_review_profile",
      label: "Strong review profile",
      angle:
        "Lead with optimization, follow-up consistency, and selective trust-signal lift for a store that already looks credible.",
      reasons: [
        "Review profile is strong enough to justify an optimization-first motion",
      ],
      confidenceLevel: "medium",
      updatedAt: now,
    };
  }

  return {
    key: "core_reviews_pain",
    label: "Core reviews pain",
    angle:
      "Lead with visible review-response gaps, trust friction, and where appointments may be leaking.",
    reasons: dedupeStrings([
      rating != null && rating <= 4.0
        ? "Rating leaves visible room for trust improvement"
        : undefined,
      reviewCount != null && reviewCount < 20
        ? "Review volume is still relatively light"
        : undefined,
      "Classic reviews / reputation pain is still the clearest front-door motion",
    ]),
    confidenceLevel: "medium",
    updatedAt: now,
  };
}
