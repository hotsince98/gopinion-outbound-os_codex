import { ModuleShell } from "@/components/ui/module-shell";

export const metadata = {
  title: "Learning",
};

export default function LearningPage() {
  return (
    <ModuleShell
      eyebrow="Learning Layer"
      title="Insights and experiments shell"
      description="Experiments, insights, and memory entries will live here once outcome data starts flowing through the system."
      cardTitle="Learning workspace"
      cardDescription="Reserved for analytics, experiment tracking, and memory signals."
      emptyTitle="No learning data yet"
      emptyDescription="The dashboard shows mock insight cards for now, but this dedicated layer starts after reply and appointment outcomes exist."
    />
  );
}
