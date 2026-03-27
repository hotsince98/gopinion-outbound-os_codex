"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import type { RankedContactPreview } from "@/lib/data/selectors/shared";

export function ContactRankingStack(props: Readonly<{
  totalLabel: string;
  items: RankedContactPreview[];
}>) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{props.totalLabel}</p>
      {props.items.length > 0 ? (
        props.items.map((item) => (
          <div
            key={item.id}
            className="min-w-0 rounded-2xl border border-white/8 bg-black/10 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={item.slotLabel}
                tone={item.slotLabel === "Primary" ? "success" : item.slotLabel === "Secondary" ? "accent" : "muted"}
              />
              <StatusBadge
                label={item.qualityBadge.label}
                tone={item.qualityBadge.tone}
              />
              <StatusBadge
                label={item.organizationBadge.label}
                tone={item.organizationBadge.tone}
              />
              {item.isNamedPerson ? (
                <StatusBadge label="Named person" tone="accent" />
              ) : null}
            </div>
            <p className="mt-3 break-words text-sm font-medium text-copy">{item.label}</p>
            <p className="mt-1 text-sm text-muted">{item.roleLabel}</p>
            <p className="mt-2 break-words text-sm text-copy">{item.contactPathLabel}</p>
            <p className="mt-2 text-sm text-copy">{item.reason}</p>
            {item.supportingReasons.map((reason) => (
              <p key={`${item.id}-${reason}`} className="mt-2 text-sm text-muted">
                {reason}
              </p>
            ))}
            {item.whyLower ? (
              <p className="mt-2 text-sm text-muted">{item.whyLower}</p>
            ) : null}
            {item.demotionDetails.map((reason) => (
              <p key={`${item.id}-demotion-${reason}`} className="mt-2 text-sm text-muted">
                {reason}
              </p>
            ))}
            <p className="mt-2 break-words text-sm text-muted">{item.sourceLabel}</p>
            {item.warnings[0] ? (
              <p className="mt-2 break-words text-sm text-warning">{item.warnings[0]}</p>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted">No ranked contact paths yet.</p>
      )}
    </div>
  );
}
