import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export function ModuleShell({
  eyebrow,
  title,
  description,
  cardTitle,
  cardDescription,
  emptyTitle,
  emptyDescription,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  cardTitle: string;
  cardDescription: string;
  emptyTitle: string;
  emptyDescription: string;
}>) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <SectionCard title={cardTitle} description={cardDescription}>
        <EmptyState
          eyebrow={eyebrow}
          title={emptyTitle}
          description={emptyDescription}
        />
      </SectionCard>
    </div>
  );
}
