export interface NavigationItem {
  title: string;
  href: string;
  description: string;
}

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Operations overview and daily execution.",
  },
  {
    title: "Graph",
    href: "/graph",
    description: "Workflow visibility and command-center shell.",
  },
  {
    title: "Leads",
    href: "/leads",
    description: "Lead intake, triage, and qualification queue.",
  },
  {
    title: "Companies",
    href: "/companies",
    description: "Dealer records, enrichment, and fit signals.",
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    description: "Sequences, enrollments, and outbound control.",
  },
  {
    title: "Inbox",
    href: "/inbox",
    description: "Reply triage, review queues, and booking handoff.",
  },
  {
    title: "Appointments",
    href: "/appointments",
    description: "Booked meetings, confirmations, and near-term pipeline.",
  },
  {
    title: "Learning",
    href: "/learning",
    description: "Insights, experiments, and memory layer.",
  },
  {
    title: "Settings",
    href: "/settings",
    description: "Providers, offer config, and system controls.",
  },
];
