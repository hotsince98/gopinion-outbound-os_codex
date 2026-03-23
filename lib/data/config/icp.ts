import type { IcpProfile } from "@/lib/domain";

export const initialIcpProfiles: IcpProfile[] = [
  {
    id: "icp_primary_used_car_dealer",
    name: "Primary Dealer ICP",
    market: "U.S. independent used car dealerships",
    summary:
      "Dream-fit independent dealers selling roughly 11-25 cars per month with a website, a claimed Google Business Profile, visible review signals, and enough digital maturity to respond to structured outbound.",
    monthlyCarsSoldRange: { min: 11, max: 25 },
    ageRange: { min: 38, max: 52 },
    googleRatingRange: { min: 3.2, max: 4.0 },
    reviewCountRange: { min: 15, max: 150 },
    websiteRequired: true,
    claimedGoogleBusinessProfileRequired: true,
    softwareToolCountMin: 2,
    qualificationSignals: [
      "Independent used car dealer",
      "Low or inconsistent review response",
      "Growth-oriented, pain-aware, or solution-aware",
      "Likely owner-operated or GM-led",
    ],
    disqualifiers: [
      "No website and no Google Business Profile",
      "Under 5 cars per month",
      "Already locked into Birdeye or Podium",
      "4.8+ stars with no visible pain",
      "Corporate franchise group",
      "Highly tech-resistant or retiring operator",
    ],
    likelyPains: [
      "Inconsistent review generation",
      "Weak review response discipline",
      "Underperforming Google Business Profile presence",
      "Limited time for structured marketing operations",
    ],
    likelyObjections: [
      "We already have something for reviews.",
      "We do not need another tool.",
      "I am too busy for this right now.",
    ],
    proofAngles: [
      "Visible public review and response gaps",
      "Operational clarity instead of marketing fluff",
      "Evidence tied to appointments, not just sends",
    ],
    decisionMakerHypotheses: [
      "owner",
      "operator_owner",
      "general_manager",
      "dealership_manager",
    ],
    channelNotes: [
      "Email-first is the cleanest v1 motion.",
      "Short personalized follow-up works best for Tier 1 dealers.",
    ],
  },
  {
    id: "icp_secondary_used_car_dealer",
    name: "Secondary Dealer ICP",
    market: "U.S. independent used car dealerships",
    summary:
      "Still-fit dealers with similar operational signals, but usually slower-moving, more pragmatic, and less digitally active.",
    monthlyCarsSoldRange: { min: 6, max: 25 },
    ageRange: { min: 40, max: 58 },
    googleRatingRange: { min: 3.5, max: 4.3 },
    reviewCountRange: { min: 30, max: 200 },
    websiteRequired: true,
    claimedGoogleBusinessProfileRequired: true,
    softwareToolCountMin: 1,
    qualificationSignals: [
      "Independent used car dealer",
      "Website and GBP present",
      "Pain is still visible but less urgent",
      "Pragmatic operator likely needs more trust-building",
    ],
    disqualifiers: [
      "No website and no Google Business Profile",
      "Corporate franchise group",
      "Dealer already deeply locked into Birdeye or Podium",
    ],
    likelyPains: [
      "Inconsistent customer follow-up",
      "Lower urgency around reputation gaps",
      "Less appetite for complex systems",
    ],
    likelyObjections: [
      "We are doing okay right now.",
      "This sounds like extra work.",
      "I only want something simple.",
    ],
    proofAngles: [
      "Low-friction setup",
      "Simple reputation lift story",
      "Operational fit for smaller teams",
    ],
    decisionMakerHypotheses: [
      "owner",
      "general_manager",
      "dealership_manager",
    ],
    channelNotes: [
      "Email-first still works best, but with a slower cadence.",
      "Broader messaging is acceptable for Tier 2 accounts.",
    ],
  },
];

export const emailFirstRationale = [
  "Email-first is straightforward to model in campaigns and sequences.",
  "It supports personalization without heavyweight provider complexity.",
  "Replies become structured learning data for future classification and booking flows.",
];
