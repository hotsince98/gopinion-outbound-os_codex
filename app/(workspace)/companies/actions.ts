"use server";

import { revalidatePath } from "next/cache";
import { getDataAccess } from "@/lib/data/access";
import {
  buildRecordProvidedDiscoverySnapshot,
  mergeWebsiteDiscoveryEvidence,
  selectPreferredSupportingPage,
} from "@/lib/data/enrichment/discovery";
import { classifySupportingPageCandidate } from "@/lib/data/enrichment/site-pages";
import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type { Company, CompanyEnrichmentSnapshot, CompanyId } from "@/lib/domain";
import type { PreferredSupportingPageActionState } from "@/app/(workspace)/companies/action-state";

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
