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
      <div className="surface-soft mt-4 p-4">
        <p className="micro-label">Review target</p>
        <p className="mt-2 break-words text-[0.95rem] font-medium leading-6 text-copy">
          {reviewTarget ?? "No website candidate available yet"}
        </p>
      </div>
      {props.reason ? (
        <p className="mt-4 break-words text-sm leading-6 text-copy">{props.reason}</p>
      ) : null}
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
        <div className="surface-soft p-3">
          <p className="micro-label">Discovery source</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.sourceLabel ?? "Discovery source pending"}
          </p>
        </div>
        <div className="surface-soft p-3">
          <p className="micro-label">Review source</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.reviewSourceLabel ?? "No operator review yet"}
          </p>
        </div>
        <div className="surface-soft p-3">
          <p className="micro-label">Reviewed</p>
          <p className="mt-2 break-words text-sm text-muted">
            {props.reviewedAtLabel ?? "Pending"}
          </p>
        </div>
      </div>
      {props.candidateDiagnostics && props.candidateDiagnostics.length > 0 ? (
        <div className="surface-soft mt-4 p-4">
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
            className="field-shell"
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
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
          {canConfirm ? (
            <button
              type="submit"
              name="intent"
              value="confirm_and_rerun"
              disabled={isPending}
              className="button-success disabled:cursor-not-allowed disabled:opacity-60"
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
              className="button-warning disabled:cursor-not-allowed disabled:opacity-60"
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
              className="button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Working..." : "Rerun enrichment"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
