"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SelectorBadge } from "@/lib/data/selectors/shared";

export function ProviderRunSummary(props: Readonly<{
  badge: SelectorBadge;
  label: string;
  fallback: string;
  evidence: string;
  pageUsage: string;
}>) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={props.badge.label} tone={props.badge.tone} />
      </div>
      <p className="break-words text-sm text-copy">{props.label}</p>
      <p className="break-words text-sm text-muted">{props.pageUsage}</p>
      <p className="break-words text-sm text-muted">{props.fallback}</p>
      <p className="break-words text-sm text-copy">{props.evidence}</p>
    </div>
  );
}
