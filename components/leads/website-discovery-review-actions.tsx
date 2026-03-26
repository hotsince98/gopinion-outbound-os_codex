"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initialWebsiteDiscoveryReviewActionState,
} from "@/app/(workspace)/companies/action-state";
import { reviewWebsiteDiscoveryCandidateAction } from "@/app/(workspace)/companies/actions";

export function WebsiteDiscoveryReviewActions(props: Readonly<{
  companyId: string;
  candidateWebsite?: string;
  officialWebsite?: string;
  compactLabel?: string;
}>) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    reviewWebsiteDiscoveryCandidateAction,
    initialWebsiteDiscoveryReviewActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (!props.candidateWebsite && !props.officialWebsite) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="companyId" value={props.companyId} />
      <input
        type="hidden"
        name="candidateWebsite"
        value={props.candidateWebsite ?? ""}
      />
      <input
        type="hidden"
        name="officialWebsite"
        value={props.officialWebsite ?? props.candidateWebsite ?? ""}
      />
      <div className="flex flex-wrap gap-2">
        {props.candidateWebsite ? (
          <>
            <button
              type="submit"
              name="intent"
              value="confirm_and_rerun"
              disabled={isPending}
              className="rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : props.compactLabel ?? "Mark official + rerun"}
            </button>
            <button
              type="submit"
              name="intent"
              value="reject_candidate"
              disabled={isPending}
              className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : "Reject"}
            </button>
          </>
        ) : props.officialWebsite ? (
          <button
            type="submit"
            name="intent"
            value="rerun_enrichment"
            disabled={isPending}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Working..." : "Rerun enrichment"}
          </button>
        ) : null}
      </div>
      {state.message ? (
        <p
          className={`text-xs ${
            state.status === "error" ? "text-warning" : "text-muted"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
