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
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
      {props.items.map((item) => (
        <div
          key={item.label}
          className="surface-soft flex min-w-0 flex-col gap-3 px-4 py-4"
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
