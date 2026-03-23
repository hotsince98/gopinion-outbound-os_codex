import type { Offer } from "@/lib/domain";

const seedTimestamp = "2026-03-23T12:00:00.000Z";

export const initialOffers: Offer[] = [
  {
    id: "offer_reviews_reputation",
    name: "Reviews / Reputation",
    category: "reviews_reputation",
    description:
      "A dealer-first reputation offer focused on review response discipline, trust signals, and measurable credibility lift.",
    problemSolved:
      "Weak or inconsistent review management that erodes shopper trust and hides visible reputation gaps.",
    bestFitSummary:
      "Best for independent dealers with public review volume, middling ratings, and obvious room to improve response behavior.",
    fitSignals: [
      "Google rating around 3.2-4.0",
      "15-150 reviews",
      "Low or inconsistent review response",
      "Visible trust gap against nearby competitors",
    ],
    firstOutreachAngle:
      "Lead with the visible review-response gap and how it affects trust without adding operational burden.",
    primaryCta:
      "Invite the dealer to a short working session to review the visible reputation gaps and where appointments may be leaking.",
    timing: "front_door",
    isPrimaryFrontDoor: true,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
  },
  {
    id: "offer_naps",
    name: "NAPS",
    category: "naps",
    description:
      "A more operational offer for dealers that need structured post-sale follow-up and review aggregation support.",
    problemSolved:
      "Fragmented post-sale follow-up and inconsistent review aggregation across the dealership workflow.",
    bestFitSummary:
      "Best for dealers with enough operational maturity to benefit from a more systemized follow-up motion.",
    fitSignals: [
      "Dealer already values reviews but execution is inconsistent",
      "Customer follow-up appears fragmented",
      "Operator is practical and ROI-aware",
      "Existing software usage suggests adoption readiness",
    ],
    firstOutreachAngle:
      "Lead with tighter follow-up, easier aggregation, and more operational consistency after the sale.",
    primaryCta:
      "Offer a short fit conversation on whether the current post-sale process is leaving review and reputation value on the table.",
    timing: "later_offer",
    isPrimaryFrontDoor: false,
    pricing: {
      setup: {
        amountUsd: 699,
        cadence: "one_time",
        label: "Setup",
      },
      recurring: {
        amountUsd: 99,
        cadence: "monthly",
        label: "Aggregates",
      },
    },
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
  },
];
