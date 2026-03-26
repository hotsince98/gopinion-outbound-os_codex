"use server";

import { revalidatePath } from "next/cache";
import { getDataAccess } from "@/lib/data/access";
import {
  buildRecordProvidedDiscoverySnapshot,
  mergeWebsiteDiscoveryEvidence,
  selectPreferredSupportingPage,
} from "@/lib/data/enrichment/discovery";
import { runLeadEnrichment } from "@/lib/data/enrichment/service";
import { classifySupportingPageCandidate } from "@/lib/data/enrichment/site-pages";
import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type {
  Company,
  CompanyEnrichmentSnapshot,
  CompanyId,
  SourceReference,
} from "@/lib/domain";
import type {
  PreferredSupportingPageActionState,
  WebsiteDiscoveryReviewActionState,
} from "@/app/(workspace)/companies/action-state";

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function normalizeSupportingPageUrl(value: string) {
  const candidate = value.trim();

  if (!candidate) {
    return undefined;
  }

  const normalized = candidate.includes("://") ? candidate : `https://${candidate}`;

  try {
    const parsed = new URL(normalized);
    parsed.hash = "";

    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, "") || ""}${parsed.search}`;
  } catch {
    return undefined;
  }
}

function normalizeOfficialWebsiteUrl(value: string | undefined) {
  const normalized = normalizeWebsiteUrl(value);

  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);

    return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
  } catch {
    return undefined;
  }
}

function buildFallbackEnrichmentSnapshot(params: {
  company: Company;
  websiteDiscovery: NonNullable<CompanyEnrichmentSnapshot["websiteDiscovery"]>;
  now: string;
}): CompanyEnrichmentSnapshot {
  return {
    confidenceLevel: params.company.enrichment?.confidenceLevel ?? "none",
    confidenceScore: params.company.enrichment?.confidenceScore ?? 24,
    contactPath: params.company.enrichment?.contactPath ?? "none",
    enrichmentSource: params.company.enrichment?.enrichmentSource ?? "record_only",
    sourceUrls: params.company.enrichment?.sourceUrls ?? [],
    pagesChecked: params.company.enrichment?.pagesChecked ?? [],
    foundEmails: params.company.enrichment?.foundEmails ?? [],
    foundPhones: params.company.enrichment?.foundPhones ?? [],
    foundNames: params.company.enrichment?.foundNames ?? [],
    websiteDiscovery: params.websiteDiscovery,
    noteHints: params.company.enrichment?.noteHints ?? [],
    segment: params.company.enrichment?.segment,
    outreachAngle: params.company.enrichment?.outreachAngle,
    descriptionSnippet: params.company.enrichment?.descriptionSnippet,
    missingFields: params.company.enrichment?.missingFields ?? [],
    manualReviewRequired: params.company.enrichment?.manualReviewRequired ?? true,
    linkedinVerificationNeeded:
      params.company.enrichment?.linkedinVerificationNeeded ?? false,
    linkedinVerified: params.company.enrichment?.linkedinVerified ?? false,
    lastEnrichedAt: params.company.enrichment?.lastEnrichedAt,
    lastAttemptedAt: params.now,
    lastError: params.company.enrichment?.lastError,
  };
}

function revalidateCompanySurfaces() {
  revalidatePath("/companies");
  revalidatePath("/leads");
  revalidatePath("/leads/enrichment");
  revalidatePath("/dashboard");
}

function buildWebsiteReviewSource(now: string): SourceReference {
  return {
    kind: "manual",
    provider: "operator_website_review",
    label: "Operator website review",
    observedAt: now,
  };
}

function clearCompanyWebsite(company: Company) {
  return {
    ...company.presence,
    hasWebsite: false,
    websiteUrl: undefined,
  };
}

export async function savePreferredSupportingPageAction(
  _previousState: PreferredSupportingPageActionState,
  formData: FormData,
): Promise<PreferredSupportingPageActionState> {
  try {
    const companyId = formData.get("companyId")?.toString().trim() as CompanyId | undefined;
    const preferredPageInput = formData.get("preferredPageUrl")?.toString().trim() ?? "";

    if (!companyId) {
      return {
        status: "error",
        message: "A company must be selected before saving a preferred supporting page.",
      };
    }

    const normalizedPreferredPage = normalizeSupportingPageUrl(preferredPageInput);

    if (!normalizedPreferredPage) {
      return {
        status: "error",
        message: "Enter a valid supporting page URL before saving it.",
      };
    }

    const dataAccess = getDataAccess();
    const company = await dataAccess.companies.getById(companyId);

    if (!company) {
      return {
        status: "error",
        message: "The selected company could not be loaded.",
      };
    }

    const now = new Date().toISOString();
    const preferredPageUrl = new URL(normalizedPreferredPage);
    const rootWebsite =
      normalizeWebsiteUrl(company.presence.websiteUrl) ??
      normalizeWebsiteUrl(company.enrichment?.websiteDiscovery?.discoveredWebsite) ??
      `${preferredPageUrl.protocol}//${preferredPageUrl.host.toLowerCase()}`;
    const rootHost = new URL(rootWebsite).hostname.replace(/^www\./, "").toLowerCase();
    const preferredHost = preferredPageUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (
      preferredHost !== rootHost &&
      !preferredHost.endsWith(`.${rootHost}`) &&
      !rootHost.endsWith(`.${preferredHost}`)
    ) {
      return {
        status: "error",
        message:
          "The preferred page must live on the company’s own website domain so future enrichment can reuse it safely.",
      };
    }

    const currentDiscovery =
      company.enrichment?.websiteDiscovery ??
      buildRecordProvidedDiscoverySnapshot({
        website: rootWebsite,
        now,
        source: company.source,
        matchedSignals: ["Website was already present on the company record"],
      });
    const pageKind =
      classifySupportingPageCandidate({ href: normalizedPreferredPage }) ?? "staff";
    const nextPreferredPage = selectPreferredSupportingPage({
      now,
      current: currentDiscovery.preferredSupportingPage,
      supportingPageUrls: dedupeStrings([
        ...currentDiscovery.supportingPageUrls,
        normalizedPreferredPage,
      ]),
      contactPageUrls:
        pageKind === "contact"
          ? dedupeStrings([
              ...currentDiscovery.contactPageUrls,
              normalizedPreferredPage,
            ])
          : currentDiscovery.contactPageUrls,
      staffPageUrls:
        pageKind === "staff"
          ? dedupeStrings([
              ...currentDiscovery.staffPageUrls,
              normalizedPreferredPage,
            ])
          : currentDiscovery.staffPageUrls,
      extractedEvidence: dedupeStrings([
        ...currentDiscovery.extractedEvidence,
        `Operator confirmed ${pageKind} page: ${normalizedPreferredPage}`,
      ]),
      source: "operator_confirmed",
    });
    const nextDiscovery = mergeWebsiteDiscoveryEvidence({
      snapshot: currentDiscovery,
      now,
      supportingPageUrls: [normalizedPreferredPage],
      contactPageUrls: pageKind === "contact" ? [normalizedPreferredPage] : [],
      staffPageUrls: pageKind === "staff" ? [normalizedPreferredPage] : [],
      extractedEvidence: [
        `Operator confirmed ${pageKind} page: ${normalizedPreferredPage}`,
      ],
      preferredSupportingPage: nextPreferredPage,
    });
    const nextEnrichment = buildFallbackEnrichmentSnapshot({
      company,
      websiteDiscovery: nextDiscovery,
      now,
    });

    await dataAccess.companies.update({
      ...company,
      enrichment: nextEnrichment,
      updatedAt: now,
    });

    revalidateCompanySurfaces();

    return {
      status: "success",
      message: "Preferred supporting page saved. Future enrichment runs will reuse it first.",
    };
  } catch {
    return {
      status: "error",
      message:
        "The preferred supporting page could not be saved right now. Try again in a moment.",
    };
  }
}

export async function reviewWebsiteDiscoveryCandidateAction(
  _previousState: WebsiteDiscoveryReviewActionState,
  formData: FormData,
): Promise<WebsiteDiscoveryReviewActionState> {
  try {
    const companyId = formData.get("companyId")?.toString().trim() as CompanyId | undefined;
    const intent = formData.get("intent")?.toString().trim();
    const candidateInput =
      formData.get("candidateWebsite")?.toString().trim() ?? "";
    const officialInput =
      formData.get("officialWebsite")?.toString().trim() ?? "";

    if (!companyId) {
      return {
        status: "error",
        message: "A company must be selected before reviewing a website candidate.",
      };
    }

    if (!intent) {
      return {
        status: "error",
        message: "Choose a website review action before submitting.",
      };
    }

    const dataAccess = getDataAccess();
    const company = await dataAccess.companies.getById(companyId);

    if (!company) {
      return {
        status: "error",
        message: "The selected company could not be loaded.",
      };
    }

    const now = new Date().toISOString();
    const currentDiscovery = company.enrichment?.websiteDiscovery;
    const candidateWebsite =
      normalizeOfficialWebsiteUrl(candidateInput) ??
      normalizeOfficialWebsiteUrl(currentDiscovery?.candidateWebsite) ??
      normalizeOfficialWebsiteUrl(currentDiscovery?.discoveredWebsite);
    const officialWebsite =
      normalizeOfficialWebsiteUrl(officialInput) ??
      candidateWebsite ??
      normalizeOfficialWebsiteUrl(company.presence.websiteUrl);
    const operatorSource = buildWebsiteReviewSource(now);

    if (intent === "reject_candidate") {
      if (!currentDiscovery || !candidateWebsite) {
        return {
          status: "error",
          message: "There is no website candidate available to reject right now.",
        };
      }

      const shouldClearWebsite =
        normalizeOfficialWebsiteUrl(company.presence.websiteUrl) === candidateWebsite &&
        currentDiscovery.confirmationStatus !== "record_provided" &&
        currentDiscovery.confirmationStatus !== "operator_confirmed";
      const nextDiscovery = mergeWebsiteDiscoveryEvidence({
        snapshot: currentDiscovery,
        now,
        status: shouldClearWebsite ? "not_found" : currentDiscovery.status,
        discoveredWebsite: shouldClearWebsite
          ? undefined
          : currentDiscovery.discoveredWebsite,
        candidateWebsite,
        confirmationStatus: "rejected",
        confirmationReason: `Operator rejected ${candidateWebsite} as the official website.`,
        extractedEvidence: [
          `Operator rejected website candidate: ${candidateWebsite}`,
        ],
        operatorReview: {
          status: "rejected",
          note: `Rejected candidate website ${candidateWebsite}.`,
          reviewedAt: now,
          source: operatorSource,
        },
        lastError: undefined,
      });
      const nextEnrichment = buildFallbackEnrichmentSnapshot({
        company,
        websiteDiscovery: nextDiscovery,
        now,
      });

      await dataAccess.companies.update({
        ...company,
        presence: shouldClearWebsite ? clearCompanyWebsite(company) : company.presence,
        enrichment: nextEnrichment,
        updatedAt: now,
      });

      revalidateCompanySurfaces();

      return {
        status: "success",
        message: "Website candidate rejected. The lead will stay in review until a better official site is confirmed.",
      };
    }

    if (intent === "rerun_enrichment") {
      if (!officialWebsite) {
        return {
          status: "error",
          message: "There is no confirmed or candidate website available to rerun enrichment from.",
        };
      }

      const summary = await runLeadEnrichment({
        scope: "single",
        companyIds: [companyId],
      });

      revalidateCompanySurfaces();

      return {
        status: "success",
        message:
          summary.failedCount > 0
            ? "Enrichment reran, but the latest website scan still needs review."
            : "Enrichment reran using the current official website path.",
      };
    }

    if (intent !== "confirm_and_rerun") {
      return {
        status: "error",
        message: "That website review action is not supported.",
      };
    }

    if (!officialWebsite) {
      return {
        status: "error",
        message: "Enter or confirm a valid official website before rerunning enrichment.",
      };
    }

    const nextDiscovery = mergeWebsiteDiscoveryEvidence({
      snapshot:
        currentDiscovery ??
        buildRecordProvidedDiscoverySnapshot({
          website: officialWebsite,
          now,
          source: operatorSource,
          matchedSignals: ["Operator supplied the website for confirmation."],
        }),
      now,
      status: "discovered",
      discoveredWebsite: officialWebsite,
      candidateWebsite: officialWebsite,
      confirmationStatus: "operator_confirmed",
      confirmationReason: `Operator confirmed ${officialWebsite} as the official website and queued a fresh enrichment run.`,
      extractedEvidence: [
        `Operator confirmed website candidate: ${officialWebsite}`,
      ],
      operatorReview: {
        status: "accepted",
        officialWebsite,
        note: `Marked ${officialWebsite} as the official site.`,
        reviewedAt: now,
        source: operatorSource,
      },
      lastError: undefined,
    });
    const nextEnrichment = buildFallbackEnrichmentSnapshot({
      company,
      websiteDiscovery: nextDiscovery,
      now,
    });

    await dataAccess.companies.update({
      ...company,
      presence: {
        ...company.presence,
        hasWebsite: true,
        websiteUrl: officialWebsite,
      },
      enrichment: nextEnrichment,
      updatedAt: now,
    });

    let message =
      "Official website saved. Enrichment reran with the operator-confirmed site.";

    try {
      const summary = await runLeadEnrichment({
        scope: "single",
        companyIds: [companyId],
      });

      if (summary.failedCount > 0) {
        message =
          "Official website saved, but the rerun still needs review after scanning the site.";
      }
    } catch {
      message =
        "Official website saved, but the enrichment rerun could not complete right now.";
    }

    revalidateCompanySurfaces();

    return {
      status: "success",
      message,
    };
  } catch {
    return {
      status: "error",
      message:
        "The website review action could not be completed right now. Try again in a moment.",
    };
  }
}
