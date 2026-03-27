"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SelectorBadge } from "@/lib/data/selectors/shared";

export function ConfidenceBreakdown(props: Readonly<{
  items: Array<{
    label: string;
    badge: SelectorBadge;
  }>;
}>) {
  return (
    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
      {props.items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/10 px-3 py-3"
        >
          <p className="text-sm text-muted">{item.label}</p>
          <div>
            <StatusBadge label={item.badge.label} tone={item.badge.tone} />
          </div>
        </div>
      ))}
    </div>
  );
}
