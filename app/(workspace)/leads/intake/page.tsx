import Link from "next/link";
import { CsvLeadImportForm } from "@/components/leads/csv-lead-import-form";
import { ManualLeadForm } from "@/components/leads/manual-lead-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export const metadata = {
  title: "Lead Intake",
};

export const dynamic = "force-dynamic";

export default function LeadIntakePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead Intake"
        title="Create and import live lead records"
        description="Add new companies into the real intake pipeline without waiting on seed data. Manual entry and CSV import both persist through the shared repository boundary."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads"
              className="button-primary"
            >
              Back to leads
            </Link>
            <Link
              href="/companies"
              className="button-secondary"
            >
              Open companies
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Manual lead creation"
          description="Capture a single company with enough structured market and review context to enter the live intake queue cleanly."
        >
          <ManualLeadForm />
        </SectionCard>

        <SectionCard
          title="CSV import foundation"
          description="Upload a modest CSV, preview the mapped rows and review context, then import them into the same intake workflow."
        >
          <CsvLeadImportForm />
        </SectionCard>
      </div>
    </div>
  );
}
