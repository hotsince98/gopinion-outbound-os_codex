import { emailFirstRationale } from "@/lib/data/config/icp";
import { memoryEntryKinds } from "@/lib/domain";
import type {
  IcpControlConfiguration,
  IntegrationReadinessCheck,
  LearningConfiguration,
  WorkflowChannelConfiguration,
} from "@/lib/domain";

export const icpControlConfigurations: IcpControlConfiguration[] = [
  {
    profileId: "icp_primary_used_car_dealer",
    targetIndustries: ["Automotive retail", "Independent auto retail"],
    targetSubindustries: [
      "Independent used car dealerships",
      "Owner-led local dealer groups",
    ],
    dreamSummary:
      "Dealers moving roughly 11-25 cars per month with visible review-response gaps, claimed GBP coverage, and enough digital maturity to act on outbound quickly.",
    tierTwoSummary:
      "Still attractive when the same dealer shape exists but urgency is softer, review pain is less acute, or contact confidence needs another human pass.",
    avoidSummary:
      "Avoid corporate franchise groups, dealers below the minimum sales floor, accounts without website or GBP foundations, and operators already deeply locked into Birdeye or Podium.",
    preferredChannels: ["email"],
    firstOfferCategory: "reviews_reputation",
  },
  {
    profileId: "icp_secondary_used_car_dealer",
    targetIndustries: ["Automotive retail", "Independent dealer operations"],
    targetSubindustries: [
      "Smaller independent used car dealerships",
      "Pragmatic local dealer teams",
    ],
    dreamSummary:
      "Best secondary-fit dealers show real post-sale follow-up or review friction, light tool adoption, and enough trust to engage with a simpler operating conversation.",
    tierTwoSummary:
      "Pragmatic dealers with visible pain but slower urgency, smaller teams, or less appetite for aggressive personalization should stay in the active working set.",
    avoidSummary:
      "Avoid groups that want heavyweight systems immediately, dealers with no visible digital footprint, or operators already deeply committed to another reputation stack.",
    preferredChannels: ["email"],
    firstOfferCategory: "reviews_reputation",
  },
];

export const workflowChannelConfigurations: WorkflowChannelConfiguration[] = [
  {
    key: "email",
    label: "Email",
    channelKind: "email",
    role: "primary",
    status: "configured",
    summary:
      "Primary outbound lane for campaigns, sequences, replies, and appointment-driving CTA tests.",
    objective:
      "Run personalized first-touch and follow-up motion while keeping provider complexity outside the product for now.",
    activationNotes: [
      ...emailFirstRationale,
      "Launch approvals and ambiguous reply handling stay operator-controlled in v1.",
    ],
    approvalMode: "operator_required",
  },
  {
    key: "manual_research_follow_up",
    label: "Manual research follow-up",
    role: "supporting",
    status: "operator_assisted",
    summary:
      "Human-led research pass used to sharpen proof points, qualification notes, and timing-sensitive follow-up.",
    objective:
      "Support Tier 1 and timing-sensitive accounts with better context before or after the core email motion.",
    activationNotes: [
      "Used as a supporting motion where public signals justify extra human attention.",
      "No autonomous sending, scraping, or enrichment is attached to this lane yet.",
    ],
    approvalMode: "operator_required",
  },
  {
    key: "linkedin_workflow",
    label: "LinkedIn workflow",
    role: "future",
    status: "planned",
    summary:
      "Reserved for a future research-assisted social workflow once channel guardrails and provider choices are settled.",
    objective:
      "Add governed social context collection and optional manual follow-up after the email backbone is stable.",
    activationNotes: [
      "Provider selection and safe-usage rules are not defined yet.",
      "Any future motion must remain recommendation-first until approval boundaries are proven.",
    ],
    approvalMode: "recommendation_only",
  },
];

export const learningConfiguration: LearningConfiguration = {
  summary:
    "The learning layer should absorb reply, appointment, and operator-review outcomes while leaving final send, restart, and escalation decisions with humans.",
  trackedOutcomes: [
    {
      key: "appointments_booked",
      label: "Appointments booked",
      summary:
        "Track scheduled and completed appointments as the north-star outcome for campaign quality.",
      sourceEntityType: "appointment",
      trackingStatus: "mock_ready",
    },
    {
      key: "positive_replies",
      label: "Positive replies",
      summary:
        "Capture interest and booking-intent replies so offer and sequence quality can be compared.",
      sourceEntityType: "reply",
      trackingStatus: "mock_ready",
    },
    {
      key: "objection_patterns",
      label: "Objection and timing patterns",
      summary:
        "Track objection, not-now, and wrong-person signals to improve routing and future recommendation quality.",
      sourceEntityType: "reply",
      trackingStatus: "mock_ready",
    },
    {
      key: "operator_review_gates",
      label: "Operator review gates",
      summary:
        "Store human hold/approve decisions for sensitive re-entry, scope, and workflow constraints.",
      sourceEntityType: "memory_entry",
      trackingStatus: "mock_ready",
    },
  ],
  optimizationTargets: [
    "Booked appointments over raw send or reply volume",
    "Cleaner first-offer selection for each ICP profile",
    "Fewer false-positive re-entry recommendations after timing replies",
    "Higher-confidence routing into operator review when signals are mixed",
  ],
  approvalRequiredBehaviors: [
    "Launching or restarting campaigns and sequences",
    "Promoting a later-offer motion like NAPS into active follow-up",
    "Acting on low-confidence or ambiguous reply classifications",
  ],
  automaticRecommendationBehaviors: [
    "Draft ICP and offer-fit suggestions from visible signals",
    "Suggested routing notes for scoring tiers and review queues",
    "Proposed memory tags and insight summaries for operator approval",
  ],
  memoryEntryCategories: [...memoryEntryKinds],
};

export const integrationReadinessChecks: IntegrationReadinessCheck[] = [
  {
    key: "database",
    label: "Database",
    status: "pending",
    summary:
      "Typed repositories and selectors are in place, but persistence is still entirely in-memory and mock-backed.",
    owner: "Core platform",
    nextStep:
      "Introduce schema-backed repository implementations behind the existing data-access contracts.",
    blockedBy: "Schema design and migration plan",
  },
  {
    key: "calendly",
    label: "Calendly",
    status: "planned",
    summary:
      "Appointment entities exist, but booking-provider sync and inbound event handling have not started yet.",
    owner: "Scheduling",
    nextStep:
      "Define a booking event contract and map it into typed appointment lifecycle states.",
    blockedBy: "Provider contract and event mapping",
  },
  {
    key: "email_provider",
    label: "Email provider",
    status: "mock_ready",
    summary:
      "Campaign, sequence, enrollment, reply, and channel contracts are stable enough for adapter work, but no live provider is wired.",
    owner: "Outbound engine",
    nextStep:
      "Attach a provider adapter and secret management without changing the selector or page surfaces.",
    blockedBy: "Credential management and send safeguards",
  },
  {
    key: "linkedin_workflow",
    label: "LinkedIn workflow",
    status: "planned",
    summary:
      "Only a placeholder workflow exists today, with no provider contract or automation layer behind it.",
    owner: "Growth ops",
    nextStep:
      "Decide whether this remains manual research assist or becomes a governed provider-backed lane.",
    blockedBy: "Policy and provider decision",
  },
  {
    key: "ai_provider",
    label: "AI provider",
    status: "mock_ready",
    summary:
      "Insight and memory entities can already absorb recommendations, but model/provider selection is still open.",
    owner: "Learning layer",
    nextStep:
      "Choose the provider contract, evaluation rubric, and approval boundaries for recommendations.",
    blockedBy: "Model policy and evaluation harness",
  },
];
