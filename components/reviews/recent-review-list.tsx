import { StatusBadge } from "@/components/ui/status-badge";
import type { RecentReviewPreview } from "@/lib/data/selectors/shared";

export function RecentReviewList(
  props: Readonly<{
    items: RecentReviewPreview[];
    emptyMessage: string;
    maxItems?: number;
    compact?: boolean;
  }>,
) {
  const items = props.items.slice(0, props.maxItems ?? props.items.length);

  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted">{props.emptyMessage}</p>;
  }

  return (
    <div className={props.compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-2xl border border-white/8 bg-black/10 ${
            props.compact ? "p-3" : "p-4"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={item.badge.label} tone={item.badge.tone} />
            <StatusBadge
              label={item.responseBadge.label}
              tone={item.responseBadge.tone}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-copy">{item.summary}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{item.metaLabel}</p>
          <p className="mt-2 text-sm leading-6 text-copy">{item.snippet}</p>
        </div>
      ))}
    </div>
  );
}
