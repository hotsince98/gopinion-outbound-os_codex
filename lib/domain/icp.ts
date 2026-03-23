import type {
  ContactRole,
  IcpProfileId,
  NumericRange,
  OfferCategory,
  PriorityTier,
} from "@/lib/domain/shared";
import type { LeadScoreBucket } from "@/lib/domain/company";

export interface IcpProfile {
  id: IcpProfileId;
  name: string;
  market: string;
  summary: string;
  monthlyCarsSoldRange: NumericRange;
  ageRange: NumericRange;
  googleRatingRange: NumericRange;
  reviewCountRange: NumericRange;
  websiteRequired: boolean;
  claimedGoogleBusinessProfileRequired: boolean;
  softwareToolCountMin: number;
  qualificationSignals: string[];
  disqualifiers: string[];
  likelyPains: string[];
  likelyObjections: string[];
  proofAngles: string[];
  decisionMakerHypotheses: ContactRole[];
  channelNotes: string[];
}

export interface PriorityTierDefinition {
  tier: PriorityTier;
  label: string;
  scoreRange: NumericRange;
  description: string;
  recommendedOfferCategory: OfferCategory;
  recommendedChannels: string[];
}

export interface ScoringBucket {
  key: LeadScoreBucket;
  label: string;
  minScore: number;
  maxScore: number;
  description: string;
}
