import type { PriorityTierDefinition, ScoringBucket } from "@/lib/domain";

export const priorityTierDefinitions: PriorityTierDefinition[] = [
  {
    tier: "tier_1",
    label: "Tier 1",
    scoreRange: { min: 80, max: 100 },
    description:
      "Dream-fit dealer accounts with clear pain, reachable decision-makers, and strong front-door offer alignment.",
    recommendedOfferCategory: "reviews_reputation",
    recommendedChannels: ["email", "manual research follow-up"],
  },
  {
    tier: "tier_2",
    label: "Tier 2",
    scoreRange: { min: 60, max: 79 },
    description:
      "Still valuable dealer accounts, but with lower urgency or slightly weaker fit signals.",
    recommendedOfferCategory: "reviews_reputation",
    recommendedChannels: ["email"],
  },
  {
    tier: "tier_3",
    label: "Tier 3",
    scoreRange: { min: 0, max: 59 },
    description:
      "Low-priority or lower-confidence accounts that should not consume early workflow attention.",
    recommendedOfferCategory: "reviews_reputation",
    recommendedChannels: ["email"],
  },
];

export const scoringBuckets: ScoringBucket[] = [
  {
    key: "high",
    label: "High fit",
    minScore: 80,
    maxScore: 100,
    description: "Ready for priority review and likely campaign enrollment.",
  },
  {
    key: "medium",
    label: "Medium fit",
    minScore: 60,
    maxScore: 79,
    description: "Worth keeping in rotation with lighter personalization.",
  },
  {
    key: "low",
    label: "Low fit",
    minScore: 0,
    maxScore: 59,
    description: "Hold or suppress until stronger signals appear.",
  },
];
