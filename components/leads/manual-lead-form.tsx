"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { createManualLeadAction } from "@/app/(workspace)/leads/intake/actions";
import { initialManualLeadActionState } from "@/app/(workspace)/leads/intake/action-state";
import { supportedLeadIndustryOptions } from "@/lib/domain";

const inputClassName =
  "field-shell";

const reviewSlots = [
  {
    slot: 1,
    title: "Review 1",
    description: "Most recent or most urgent review to anchor the lead.",
  },
  {
    slot: 2,
    title: "Review 2",
    description: "Useful supporting context if a second recent review matters.",
  },
  {
    slot: 3,
    title: "Review 3",
    description: "Optional extra signal if the pattern matters across reviews.",
  },
] as const;

function FieldError({ message }: Readonly<{ message?: string | string[] }>) {
  if (!message) {
    return null;
  }

  if (Array.isArray(message)) {
    return (
      <div className="space-y-1">
        {message.map((item) => (
          <p key={item} className="text-sm text-rose-300">
            {item}
          </p>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-rose-300">{message}</p>;
}

function FormSection(
  props: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
  }>,
) {
  return (
    <div className="surface-muted p-5 lg:p-6">
      <div className="max-w-2xl space-y-2">
        <p className="micro-label">{props.eyebrow}</p>
        <p className="text-sm font-medium text-copy">{props.title}</p>
        <p className="text-sm leading-6 text-muted">{props.description}</p>
      </div>
      <div className="mt-5">{props.children}</div>
    </div>
  );
}

function ReviewSlotCard(
  props: Readonly<{
    slot: 1 | 2 | 3;
    title: string;
    description: string;
  }>,
) {
  return (
    <div className="surface-soft p-4 lg:p-5">
      <div className="max-w-xl space-y-2">
        <p className="micro-label">{props.title}</p>
        <p className="text-sm leading-6 text-muted">{props.description}</p>
      </div>

      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
        <label className="space-y-2">
          <span className="micro-label">Rating</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            name={`recentReview${props.slot}Rating`}
            placeholder="2.0"
            className={inputClassName}
          />
        </label>

        <label className="space-y-2">
          <span className="micro-label">Date</span>
          <input
            type="date"
            name={`recentReview${props.slot}Date`}
            className={inputClassName}
          />
        </label>

        <label className="space-y-2">
          <span className="micro-label">Author</span>
          <input
            type="text"
            name={`recentReview${props.slot}Author`}
            placeholder="Jordan P."
            className={inputClassName}
          />
        </label>

        <label className="space-y-2">
          <span className="micro-label">Response status</span>
          <select
            name={`recentReview${props.slot}ResponseStatus`}
            defaultValue=""
            className={inputClassName}
          >
            <option value="">Unknown</option>
            <option value="not_responded">No public response</option>
            <option value="responded">Responded</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="micro-label">Snippet</span>
        <textarea
          name={`recentReview${props.slot}Snippet`}
          rows={3}
          placeholder="Paste the most decision-useful part of the review."
          className={`${inputClassName} min-h-24 resize-y`}
        />
      </label>
    </div>
  );
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
          className={`rounded-[1.4rem] border px-4 py-4 ${
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

      <form ref={formRef} action={formAction} className="space-y-5">
        <FormSection
          eyebrow="Company basics"
          title="Start with the company record"
          description="Capture the core business and market context first so the record enters the queue with enough structure to be searchable and actionable."
        >
          <div className="grid gap-4 2xl:grid-cols-2">
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

          <div className="mt-4 grid gap-4 2xl:grid-cols-2">
            <div className="space-y-2">
              <span className="micro-label">Industry</span>
              <input
                type="hidden"
                name="industryKey"
                value={supportedLeadIndustryOptions[0].value}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-copy">
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

          <div className="mt-4 grid gap-4 2xl:grid-cols-[1.1fr_0.9fr_0.6fr]">
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
        </FormSection>

        <FormSection
          eyebrow="Reputation snapshot"
          title="Capture rating, volume, and up to 3 relevant reviews"
          description="These fields help the queue score urgency before enrichment. Fill only the review cards that actually add decision value."
        >
          <div className="grid gap-4 2xl:grid-cols-2">
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

          <div className="mt-5 space-y-4">
            {reviewSlots.map((reviewSlot) => (
              <ReviewSlotCard key={reviewSlot.slot} {...reviewSlot} />
            ))}

            <FieldError message={state.fieldErrors?.recentReviews} />
          </div>
        </FormSection>

        <FormSection
          eyebrow="Operator context"
          title="Add the best contact and any intake notes"
          description="Keep this lightweight. The goal is to give downstream review and enrichment enough context to move quickly without overfilling the record."
        >
          <div className="grid gap-4 2xl:grid-cols-3">
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

          <label className="mt-4 block space-y-2">
            <span className="micro-label">Notes</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="Optional operator notes about visible pain, market context, or who referred the lead."
              className={`${inputClassName} min-h-28 resize-y`}
            />
            <FieldError message={state.fieldErrors?.notes} />
          </label>
        </FormSection>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
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
