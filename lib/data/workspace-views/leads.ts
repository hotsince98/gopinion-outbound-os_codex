import type { WorkspaceViewPreset } from "@/lib/domain";

export function getLeadWorkspaceViewPresets(): WorkspaceViewPreset[] {
  return [
    {
      id: "leads_all",
      scope: "leads",
      name: "All active leads",
      description: "Default queue view across the active workspace.",
      path: "/leads",
      query: {},
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_today_imports",
      scope: "leads",
      name: "Today's imports",
      description: "Fresh records that usually need the fastest operator scan.",
      path: "/leads",
      query: {
        imported: "today",
        sort: "newest",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_ready_to_enrich",
      scope: "leads",
      name: "Ready to enrich",
      description: "Records still waiting on enrichment work.",
      path: "/leads",
      query: {
        queue: "needs_enrichment",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_ready_to_enroll",
      scope: "leads",
      name: "Ready to enroll",
      description: "Companies that already have a usable path toward campaign action.",
      path: "/leads",
      query: {
        queue: "ready",
        sort: "highest_priority",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_blocked",
      scope: "leads",
      name: "Blocked",
      description: "Catch the accounts still missing a workable path forward.",
      path: "/leads",
      query: {
        queue: "blocked",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_website_review",
      scope: "leads",
      name: "Needs website review",
      description: "Queue records whose website candidate still needs operator confirmation.",
      path: "/leads",
      query: {
        websiteReview: "needs_review",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
    {
      id: "leads_review_followup",
      scope: "leads",
      name: "Review follow-up",
      description: "Fresh low-star or unanswered review cases worth moving on quickly.",
      path: "/leads",
      query: {
        review: "urgent",
        sort: "review_priority",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
        filters: {
          signal: "urgent",
          response: "unanswered_or_recent_low_star",
        },
      },
    },
    {
      id: "leads_named_contacts",
      scope: "leads",
      name: "Named contacts",
      description: "Leads with a stronger named outreach path already available.",
      path: "/leads",
      query: {
        contactPath: "named",
        confidence: "high",
      },
      reviewLens: {
        model: "recent_relevant_reviews",
      },
    },
  ];
}
