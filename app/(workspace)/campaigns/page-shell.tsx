import { ModuleShell } from "@/components/ui/module-shell";

export const metadata = {
  title: "Campaigns",
};

export default function CampaignsShellPlaceholder() {
  return (
    <ModuleShell
      eyebrow="Campaigns"
      title="Campaign and sequence shell"
      description="Email-first campaigns, sequence enrollments, and offer routing will be implemented here after the core entities are modeled."
      cardTitle="Campaign workspace"
      cardDescription="Reserved for sequence definitions, enrollments, and execution status."
      emptyTitle="No campaigns configured yet"
      emptyDescription="The outbound engine is still intentionally mocked while the lead and decision-maker flows are defined."
    />
  );
}
