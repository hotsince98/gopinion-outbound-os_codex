import type { Tone } from "@/lib/presentation";
import { cn } from "@/lib/utils";

const toneClasses: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.035] text-copy",
  accent: "border-accent/22 bg-accent/10 text-copy",
  success: "border-success/22 bg-success/10 text-copy",
  warning: "border-warning/22 bg-warning/10 text-copy",
  danger: "border-rose-400/22 bg-rose-400/10 text-copy",
  muted: "border-white/10 bg-white/[0.028] text-muted",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: Readonly<{
  label: string;
  tone?: Tone;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em]",
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  );
}
