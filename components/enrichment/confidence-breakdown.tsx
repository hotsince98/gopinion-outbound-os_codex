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
    <div className="space-y-2">
      {props.items.map((item) => (
        <div
          key={item.label}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/10 px-3 py-2"
        >
          <p className="text-sm text-muted">{item.label}</p>
          <StatusBadge label={item.badge.label} tone={item.badge.tone} />
        </div>
      ))}
    </div>
  );
}
