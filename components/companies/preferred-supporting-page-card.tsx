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
    <div className="surface-muted min-w-0 p-4">
      <p className="micro-label">Preferred supporting page</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={props.sourceLabel}
          tone={props.sourceLabel === "Operator confirmed" ? "success" : "accent"}
        />
      </div>
      <p className="mt-3 break-words text-sm text-copy">{props.label}</p>
      {props.reason ? (
        <p className="mt-2 break-words text-sm leading-6 text-muted">{props.reason}</p>
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
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save preferred page"}
        </button>
      </form>
    </div>
  );
}
