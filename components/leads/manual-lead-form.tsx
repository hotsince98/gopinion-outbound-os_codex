"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { createManualLeadAction } from "@/app/(workspace)/leads/intake/actions";
import { initialManualLeadActionState } from "@/app/(workspace)/leads/intake/action-state";
import { supportedLeadIndustryOptions } from "@/lib/domain";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]";

function FieldError({ message }: Readonly<{ message?: string }>) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-rose-300">{message}</p>;
}

export function ManualLeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createManualLeadAction,
    initialManualLeadActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="micro-label">Manual Entry</p>
        <p className="text-sm leading-6 text-muted">
          Add a single company into the live intake queue with enough structured
          data to appear in leads, companies, and downstream review workflows.
        </p>
      </div>

      {state.message ? (
        <div
          className={`rounded-2xl border px-4 py-4 ${
            state.status === "success"
              ? "border-success/25 bg-success/10"
              : "border-warning/25 bg-warning/10"
          }`}
        >
          <p className="text-sm font-medium text-copy">{state.message}</p>
          {state.duplicateMessages?.length ? (
            <div className="mt-3 space-y-2">
              {state.duplicateMessages.map((message) => (
                <p key={message} className="text-sm text-muted">
                  {message}
                </p>
              ))}
            </div>
          ) : null}
          {state.status === "success" && state.createdCompanyId ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={`/companies?companyId=${state.createdCompanyId}`}
                className="text-sm font-medium text-accent transition hover:text-copy"
              >
                Open company profile
              </Link>
              <Link
                href="/leads"
                className="text-sm font-medium text-accent transition hover:text-copy"
              >
                Return to lead queue
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <form ref={formRef} action={formAction} className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="space-y-2">
            <span className="micro-label">Company name</span>
            <input
              required
              type="text"
              name="companyName"
              placeholder="Cedar Lane Motors"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.companyName} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Website</span>
            <input
              type="url"
              name="website"
              placeholder="https://cedarlanemotors.com"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.website} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <span className="micro-label">Industry</span>
            <input
              type="hidden"
              name="industryKey"
              value={supportedLeadIndustryOptions[0].value}
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy">
              {supportedLeadIndustryOptions[0].label}
            </div>
          </div>

          <label className="space-y-2">
            <span className="micro-label">Subindustry</span>
            <input
              type="text"
              name="subindustry"
              placeholder="Used car dealership"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.subindustry} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_0.6fr]">
          <label className="space-y-2">
            <span className="micro-label">City</span>
            <input
              required
              type="text"
              name="city"
              placeholder="Nashville"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.city} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">State</span>
            <input
              required
              type="text"
              name="state"
              placeholder="TN"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.state} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Country</span>
            <input
              required
              type="text"
              name="country"
              defaultValue="US"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.country} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="space-y-2">
            <span className="micro-label">Google rating</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              name="googleRating"
              placeholder="3.8"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.googleRating} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Review count</span>
            <input
              type="number"
              min="0"
              step="1"
              name="reviewCount"
              placeholder="47"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.reviewCount} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="micro-label">Primary contact name</span>
            <input
              type="text"
              name="primaryContactName"
              placeholder="Sam Carter"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.primaryContactName} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Contact title</span>
            <input
              type="text"
              name="contactTitle"
              placeholder="Owner"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.contactTitle} />
          </label>

          <label className="space-y-2">
            <span className="micro-label">Contact email</span>
            <input
              type="email"
              name="contactEmail"
              placeholder="sam@cedarlanemotors.com"
              className={inputClassName}
            />
            <FieldError message={state.fieldErrors?.contactEmail} />
          </label>
        </div>

        <label className="space-y-2">
          <span className="micro-label">Notes</span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Optional operator notes about visible pain, market context, or who referred the lead."
            className={`${inputClassName} min-h-28 resize-y`}
          />
          <FieldError message={state.fieldErrors?.notes} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Creating lead..." : "Create lead"}
          </button>
          <p className="text-sm text-muted">
            New records are written through the live repository boundary, not
            page-local state.
          </p>
        </div>
      </form>
    </div>
  );
}
