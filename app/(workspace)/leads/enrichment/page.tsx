import Link from "next/link";
import { LeadEnrichmentWorkspace } from "@/components/leads/lead-enrichment-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getLeadEnrichmentWorkspaceView } from "@/lib/data/selectors/lead-enrichment";

export const metadata = {
  title: "Lead Enrichment",
};

export const dynamic = "force-dynamic";

export default async function LeadEnrichmentPage() {
  const view = await getLeadEnrichmentWorkspaceView();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Enrichment"
        title="Bulk website enrichment queue"
        description="Run the first-pass website and contact-path workflow in a cleaner review queue so promising leads move toward readiness with less operator friction."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads"
              className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15"
            >
              Back to leads
            </Link>
            <Link
              href="/companies"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06]"
            >
              Open companies
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
        {view.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            change={stat.change}
            tone={stat.tone}
          />
        ))}
      </div>

      <LeadEnrichmentWorkspace view={view} />
    </div>
  );
}
