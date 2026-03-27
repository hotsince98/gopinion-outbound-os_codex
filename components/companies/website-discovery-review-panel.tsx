"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initialWebsiteDiscoveryReviewActionState,
} from "@/app/(workspace)/companies/action-state";
import { reviewWebsiteDiscoveryCandidateAction } from "@/app/(workspace)/companies/actions";
import { StatusBadge } from "@/components/ui/status-badge";

export function WebsiteDiscoveryReviewPanel(props: Readonly<{
  companyId: string;
  candidateWebsite?: string;
  officialWebsite?: string;
  canRejectCandidate?: boolean;
  confirmationLabel: string;
  confirmationTone: "neutral" | "accent" | "success" | "warning" | "danger" | "muted";
  confidenceLabel?: string;
  sourceLabel?: string;
  reason?: string;
  candidateDiagnostics?: string[];
  reviewSourceLabel?: string;
  reviewedAtLabel?: string;
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

  const reviewTarget = props.candidateWebsite ?? props.officialWebsite;
  const canReject = Boolean(props.canRejectCandidate && props.candidateWebsite);
  const canConfirm = Boolean(reviewTarget);
  const canRerun = Boolean(props.officialWebsite);

  return (
    <div className="surface-muted min-w-0 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="micro-label">Website discovery review</p>
        <StatusBadge
          label={props.confirmationLabel}
          tone={props.confirmationTone}
        />
        {props.confidenceLabel ? (
          <StatusBadge label={props.confidenceLabel} tone="muted" />
        ) : null}
      </div>
      <p className="mt-3 break-words text-base font-medium text-copy">
        {reviewTarget ?? "No website candidate available yet"}
      </p>
      {props.reason ? (
        <p className="mt-3 break-words text-sm leading-6 text-copy">{props.reason}</p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
          <p className="micro-label">Discovery source</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.sourceLabel ?? "Discovery source pending"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
          <p className="micro-label">Review source</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.reviewSourceLabel ?? "No operator review yet"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
          <p className="micro-label">Reviewed</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.reviewedAtLabel ?? "Pending"}
          </p>
        </div>
      </div>
      {props.candidateDiagnostics && props.candidateDiagnostics.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
          <p className="micro-label">Candidate diagnostics</p>
          {props.candidateDiagnostics.map((diagnostic, index) => (
            <p
              key={`${index}-${diagnostic}`}
              className="mt-2 break-words text-sm leading-6 text-muted"
            >
              {diagnostic}
            </p>
          ))}
        </div>
      ) : null}
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="companyId" value={props.companyId} />
        <input
          type="hidden"
          name="candidateWebsite"
          value={props.candidateWebsite ?? ""}
        />
        <label className="space-y-2">
          <span className="micro-label">Official website</span>
          <input
            type="url"
            name="officialWebsite"
            defaultValue={props.officialWebsite ?? props.candidateWebsite}
            placeholder="https://dealer.example.com"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]"
          />
        </label>
        {state.message ? (
          <p
            className={`text-sm ${
              state.status === "error" ? "text-warning" : "text-muted"
            }`}
          >
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {canConfirm ? (
            <button
              type="submit"
              name="intent"
              value="confirm_and_rerun"
              disabled={isPending}
              className="rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-success/50 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : "Mark official + rerun"}
            </button>
          ) : null}
          {canReject ? (
            <button
              type="submit"
              name="intent"
              value="reject_candidate"
              disabled={isPending}
              className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-warning/50 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : "Reject candidate"}
            </button>
          ) : null}
          {canRerun ? (
            <button
              type="submit"
              name="intent"
              value="rerun_enrichment"
              disabled={isPending}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-copy transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : "Rerun enrichment"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
