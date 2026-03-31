"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initialPreferredSupportingPageActionState,
} from "@/app/(workspace)/companies/action-state";
import { savePreferredSupportingPageAction } from "@/app/(workspace)/companies/actions";
import { StatusBadge } from "@/components/ui/status-badge";

export function PreferredSupportingPageCard(props: Readonly<{
  companyId: string;
  currentUrl?: string;
  label: string;
  sourceLabel: string;
  reason?: string;
}>) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    savePreferredSupportingPageAction,
    initialPreferredSupportingPageActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="surface-muted min-w-0 p-5">
      <p className="micro-label">Preferred supporting page</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={props.sourceLabel}
          tone={props.sourceLabel === "Operator confirmed" ? "success" : "accent"}
        />
      </div>
      <div className="surface-soft mt-4 p-4">
        <p className="micro-label">Current page</p>
        <p className="mt-2 break-words text-[0.95rem] font-medium leading-6 text-copy">
          {props.label}
        </p>
        {props.currentUrl ? (
          <p className="mt-2 break-words text-sm text-muted">{props.currentUrl}</p>
        ) : null}
      </div>
      {props.reason ? (
        <p className="mt-4 break-words text-sm leading-6 text-muted">{props.reason}</p>
      ) : null}
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="companyId" value={props.companyId} />
        <label className="space-y-2">
          <span className="micro-label">Operator-confirmed URL</span>
          <input
            type="url"
            name="preferredPageUrl"
            defaultValue={props.currentUrl}
            placeholder="https://dealer.example.com/meet-our-staff"
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
        <button
          type="submit"
          disabled={isPending}
          className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save preferred page"}
        </button>
      </form>
    </div>
  );
}
