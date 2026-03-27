import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedControlItem {
  href: string;
  label: string;
  count: number;
  isActive: boolean;
}

export function SegmentedControl({
  items,
}: Readonly<{
  items: SegmentedControlItem[];
}>) {
  return (
    <div className="surface-panel flex flex-wrap gap-2 p-2.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex min-w-[122px] shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
            item.isActive
              ? "border-accent/30 bg-accent/10 text-copy"
              : "border-white/8 bg-white/[0.03] text-muted hover:border-white/12 hover:bg-white/[0.05] hover:text-copy",
          )}
        >
          <span className="text-sm font-medium">{item.label}</span>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em]",
              item.isActive ? "bg-accent/15 text-copy" : "bg-white/[0.06] text-muted",
            )}
          >
            {item.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
