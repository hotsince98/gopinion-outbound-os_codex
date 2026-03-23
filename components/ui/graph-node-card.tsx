import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SelectorBadge } from "@/lib/data/selectors/shared";
import { cn } from "@/lib/utils";

export function GraphNodeCard({
  href,
  title,
  subtitle,
  statusBadge,
  metrics,
  relationCount,
  active = false,
}: Readonly<{
  href: string;
  title: string;
  subtitle: string;
  statusBadge: SelectorBadge;
  metrics: string[];
  relationCount: number;
  active?: boolean;
}>) {
  return (
    <Link
      href={href}
      className={cn(
        "surface-muted block p-4 transition",
        active
          ? "border-accent/35 bg-accent/10 shadow-[0_12px_36px_-24px_rgba(111,202,255,0.65)]"
          : "hover:border-white/12 hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-copy">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
        </div>
        <StatusBadge label={statusBadge.label} tone={statusBadge.tone} />
      </div>

      <div className="mt-4 space-y-2">
        {metrics.slice(0, 3).map((metric) => (
          <p key={metric} className="text-sm leading-6 text-muted">
            {metric}
          </p>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="micro-label">Linked records</span>
        <span className="text-sm font-medium text-copy">{relationCount}</span>
      </div>
    </Link>
  );
}
