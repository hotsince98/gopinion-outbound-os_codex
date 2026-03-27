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
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={props.badge.label} tone={props.badge.tone} />
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
        <div className="surface-muted min-w-0 p-3">
          <p className="micro-label">Provider</p>
          <p className="mt-2 break-words text-sm text-copy">{props.label}</p>
        </div>
        <div className="surface-muted min-w-0 p-3">
          <p className="micro-label">Page usage</p>
          <p className="mt-2 break-words text-sm text-muted">{props.pageUsage}</p>
        </div>
        <div className="surface-muted min-w-0 p-3">
          <p className="micro-label">Fallback</p>
          <p className="mt-2 break-words text-sm text-muted">{props.fallback}</p>
        </div>
      </div>
      <div className="surface-muted min-w-0 p-3">
        <p className="micro-label">Evidence</p>
        <p className="mt-2 break-words text-sm leading-6 text-copy">{props.evidence}</p>
      </div>
    </div>
  );
}
