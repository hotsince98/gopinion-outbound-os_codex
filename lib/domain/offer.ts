import type {
  AuditFields,
  MoneyAmount,
  OfferCategory,
  OfferId,
} from "@/lib/domain/shared";

export const offerTimings = ["front_door", "later_offer"] as const;
export type OfferTiming = (typeof offerTimings)[number];

export interface OfferPricing {
  setup?: MoneyAmount;
  recurring?: MoneyAmount;
}

export interface Offer extends AuditFields {
  id: OfferId;
  name: string;
  category: OfferCategory;
  description: string;
  problemSolved: string;
  bestFitSummary: string;
  fitSignals: string[];
  firstOutreachAngle: string;
  primaryCta: string;
  timing: OfferTiming;
  isPrimaryFrontDoor: boolean;
  pricing?: OfferPricing;
}
