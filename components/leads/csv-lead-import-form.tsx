"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { buildLeadCsvPreview, parseLeadCsvText } from "@/lib/data/intake/csv";
import { importLeadCsvAction } from "@/app/(workspace)/leads/intake/actions";
import { initialCsvLeadImportActionState } from "@/app/(workspace)/leads/intake/action-state";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-copy outline-none transition placeholder:text-muted focus:border-accent/35 focus:bg-white/[0.05]";

export function CsvLeadImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    importLeadCsvAction,
    initialCsvLeadImportActionState,
  );
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [clientError, setClientError] = useState<string>();
  const [preview, setPreview] = useState<ReturnType<typeof buildLeadCsvPreview>>();

  useEffect(() => {
    if (state.status === "success") {
      setCsvText("");
      setFileName("");
      setPreview(undefined);
      setClientError(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [state.status]);

  async function handleFileChange(file: File | undefined) {
    if (!file) {
      setCsvText("");
      setFileName("");
      setPreview(undefined);
      setClientError(undefined);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseLeadCsvText(text);
      const nextPreview = buildLeadCsvPreview(parsed);

      setCsvText(text);
      setFileName(file.name);
      setPreview(nextPreview);
      setClientError(
        parsed.rows.length === 0
          ? "No rows were detected in the uploaded CSV."
          : undefined,
      );
    } catch {
      setCsvText("");
      setFileName("");
      setPreview(undefined);
      setClientError("The CSV could not be read. Try saving it again and re-uploading.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="micro-label">CSV Import</p>
        <p className="text-sm leading-6 text-muted">
          Upload a modest CSV, preview the mapped lead rows, and import them into
          the same live intake pipeline used by manual entry.
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
          {state.summary ? (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="micro-label">Created companies</p>
                <p className="mt-2 text-xl font-semibold text-copy">
                  {state.summary.createdCompanies}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="micro-label">Created contacts</p>
                <p className="mt-2 text-xl font-semibold text-copy">
                  {state.summary.createdContacts}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="micro-label">Duplicate rows</p>
                <p className="mt-2 text-xl font-semibold text-copy">
                  {state.summary.duplicateRows}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="micro-label">Invalid rows</p>
                <p className="mt-2 text-xl font-semibold text-copy">
                  {state.summary.invalidRows}
                </p>
              </div>
            </div>
          ) : null}
          {state.summary?.notices.length ? (
            <div className="mt-3 space-y-2">
              {state.summary.notices.map((notice) => (
                <p key={notice} className="text-sm text-muted">
                  {notice}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <label className="space-y-2">
          <span className="micro-label">Upload CSV</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className={inputClassName}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              void handleFileChange(file);
            }}
          />
        </label>

        <textarea hidden readOnly name="csvText" value={csvText} />

        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="micro-label">Expected columns</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            `company name`, `company`, `business name`, `business`, `name`,
            `address`, `website`, `phone`, `emails`, `category`, `city`,
            `state`, `zip`, `country`, `google rating`, `review count`,
            `number of reviews`, `latest review snippet`, `latest review rating`,
            `latest review date`, `latest review author`,
            `latest review response status`, `primary contact name`,
            `contact title`, `contact email`, `notes`
          </p>
        </div>

        {clientError ? (
          <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-4">
            <p className="text-sm font-medium text-copy">{clientError}</p>
          </div>
        ) : null}

        {preview?.warnings.length ? (
          <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-4">
            <p className="micro-label">Mapping warnings</p>
            <div className="mt-3 space-y-2">
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-sm text-copy">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4 rounded-3xl border border-white/8 bg-black/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="micro-label">Preview</p>
                <p className="mt-2 text-sm text-muted">
                  {fileName || "Uploaded file"} • {preview.totalRows} rows detected
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted">
                <span>{preview.validRows} valid</span>
                <span>{preview.invalidRows} invalid</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="micro-label">Detected columns</p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {preview.detectedColumns.join(" • ") || "None detected"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="micro-label">Detected mapping</p>
                <div className="mt-3 space-y-2">
                  {preview.columnMappings.length ? (
                    preview.columnMappings.map((mapping) => (
                      <div
                        key={`${mapping.header}-${mapping.mappedField}`}
                        className="flex flex-wrap items-start justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="text-copy">{mapping.header}</p>
                          {mapping.note ? (
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                              {mapping.note}
                            </p>
                          ) : null}
                        </div>
                        <p
                          className={
                            mapping.strategy === "unmapped"
                              ? "text-warning"
                              : mapping.strategy === "inferred"
                                ? "text-accent"
                                : "text-muted"
                          }
                        >
                          {mapping.mappedField}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-muted">
                      No supported columns mapped
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {preview.rows.map((row) => (
                <div key={row.rowNumber} className="surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-copy">
                        Row {row.rowNumber} • {row.companyName}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {row.marketLabel} • {row.contactLabel}
                      </p>
                    </div>
                    {row.website ? (
                      <p className="text-sm text-muted">{row.website}</p>
                    ) : null}
                  </div>
                  {row.issues.length ? (
                    <div className="mt-3 space-y-1">
                      {row.issues.map((issue) => (
                        <p key={issue} className="text-sm text-warning">
                          {issue}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-success">
                      Ready to import
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !preview || preview.validRows === 0}
            className="rounded-full border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-copy transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Importing leads..." : "Import CSV leads"}
          </button>
          <p className="text-sm text-muted">
            Invalid or duplicate rows are skipped with notices instead of
            crashing the import.
          </p>
        </div>
      </form>
    </div>
  );
}
