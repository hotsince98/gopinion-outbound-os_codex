import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-accent/20 bg-accent/10 text-copy",
  positive: "border-success/20 bg-success/10 text-copy",
  warning: "border-warning/20 bg-warning/10 text-copy",
} as const;

export function StatCard({
  label,
  value,
  detail,
  change,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string;
  detail?: string;
  change?: string;
  tone?: keyof typeof toneClasses;
}>) {
  return (
    <article className="surface-panel p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="micro-label">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-copy">
            {value}
          </p>
        </div>

        {change ? (
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
              toneClasses[tone],
            )}
          >
            {change}
          </span>
        ) : null}
      </div>

      {detail ? (
        <div className="mt-4 border-t border-white/8 pt-4">
          <p className="text-sm leading-6 text-muted">{detail}</p>
        </div>
      ) : null}
    </article>
  );
}
