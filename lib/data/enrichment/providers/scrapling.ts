import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { basicWebsiteEnrichmentProvider } from "@/lib/data/enrichment/providers/basic";
import type { WebsiteScanResult } from "@/lib/data/enrichment/web";
import type {
  WebsiteEnrichmentProviderAdapter,
  WebsiteEnrichmentScanParams,
} from "@/lib/data/enrichment/providers/types";

interface ScraplingWorkerRequest {
  website?: string;
  preferred_page_urls?: string[];
  likely_page_paths?: string[];
}

interface ScraplingWorkerPersonResult {
  full_name: string;
  title?: string;
  source_url: string;
  confidence: "high" | "medium" | "low";
}

interface ScraplingWorkerPageResult {
  url: string;
  page_kind: "homepage" | "contact" | "about" | "team" | "staff" | "other";
  status: "fetched" | "skipped" | "failed";
  title?: string;
  contact_form_detected?: boolean;
  error?: string;
}

interface ScraplingWorkerResponse {
  website_used?: string;
  pages_crawled: ScraplingWorkerPageResult[];
  emails_found: string[];
  phones_found: string[];
  people_found: ScraplingWorkerPersonResult[];
  role_inbox_clues: string[];
  contact_form_urls: string[];
  source_evidence: string[];
  confidence_hints: string[];
  warnings: string[];
  errors: string[];
  category_clues: string[];
  description_snippet?: string;
  external_presence_hints: string[];
}

const DEFAULT_SCRAPLING_PAGE_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/meet-our-team",
  "/meet-our-staff",
  "/meet-the-team",
  "/meet-the-staff",
  "/our-team",
  "/our-staff",
  "/sales-team",
  "/sales-staff",
  "/management",
  "/staff-directory",
  "/team-directory",
] as const;

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function getConfiguredPythonBin() {
  return process.env.SCRAPLING_PYTHON_BIN?.trim() || "python3";
}

function getConfiguredWorkerEntry() {
  return (
    process.env.SCRAPLING_WORKER_ENTRY?.trim() ||
    path.join(process.cwd(), "workers", "enrichment", "main.py")
  );
}

function getConfiguredTimeoutMs() {
  const parsed = Number(process.env.SCRAPLING_WORKER_TIMEOUT_MS);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20_000;
  }

  return parsed;
}

function buildFallbackEvidenceMessage(message: string) {
  return `Scrapling worker fallback: ${message}`;
}

function parseWorkerResponse(raw: string): ScraplingWorkerResponse {
  const parsed = JSON.parse(raw) as Partial<ScraplingWorkerResponse>;

  return {
    website_used: parsed.website_used,
    pages_crawled: Array.isArray(parsed.pages_crawled) ? parsed.pages_crawled : [],
    emails_found: Array.isArray(parsed.emails_found) ? parsed.emails_found : [],
    phones_found: Array.isArray(parsed.phones_found) ? parsed.phones_found : [],
    people_found: Array.isArray(parsed.people_found) ? parsed.people_found : [],
    role_inbox_clues: Array.isArray(parsed.role_inbox_clues)
      ? parsed.role_inbox_clues
      : [],
    contact_form_urls: Array.isArray(parsed.contact_form_urls)
      ? parsed.contact_form_urls
      : [],
    source_evidence: Array.isArray(parsed.source_evidence) ? parsed.source_evidence : [],
    confidence_hints: Array.isArray(parsed.confidence_hints)
      ? parsed.confidence_hints
      : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    category_clues: Array.isArray(parsed.category_clues) ? parsed.category_clues : [],
    description_snippet: parsed.description_snippet,
    external_presence_hints: Array.isArray(parsed.external_presence_hints)
      ? parsed.external_presence_hints
      : [],
  };
}

async function runScraplingWorker(
  payload: ScraplingWorkerRequest,
): Promise<ScraplingWorkerResponse> {
  const workerEntry = getConfiguredWorkerEntry();

  if (!existsSync(workerEntry)) {
    throw new Error(`Worker entry was not found at ${workerEntry}`);
  }

  const pythonBin = getConfiguredPythonBin();
  const timeoutMs = getConfiguredTimeoutMs();

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [workerEntry], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };
    const finish = (response: ScraplingWorkerResponse) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(response);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      fail(new Error(`Timed out after ${timeoutMs}ms while waiting for Scrapling worker output.`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      fail(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        fail(
          new Error(
            stderr.trim() || `Scrapling worker exited with status ${code ?? "unknown"}.`,
          ),
        );
        return;
      }

      try {
        finish(parseWorkerResponse(stdout));
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error("Scrapling worker returned invalid JSON."),
        );
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

function mapWorkerResultToWebsiteScanResult(
  result: ScraplingWorkerResponse,
): WebsiteScanResult {
  const pagesChecked = dedupeStrings(result.pages_crawled.map((page) => page.url));
  const sourceUrls = dedupeStrings(
    result.pages_crawled
      .filter((page) => page.status === "fetched")
      .map((page) => page.url),
  );
  const contactPageUrls = dedupeStrings([
    ...result.pages_crawled
      .filter((page) => page.page_kind === "contact")
      .map((page) => page.url),
    ...result.contact_form_urls,
  ]);
  const staffPageUrls = dedupeStrings(
    result.pages_crawled
      .filter((page) => page.page_kind === "staff" || page.page_kind === "team")
      .map((page) => page.url),
  );
  const supportingPageUrls = dedupeStrings([
    ...result.pages_crawled
      .filter((page) => page.page_kind !== "homepage")
      .map((page) => page.url),
    ...contactPageUrls,
    ...staffPageUrls,
  ]);
  const evidenceSummary = dedupeStrings([
    ...result.source_evidence,
    ...result.confidence_hints,
    ...result.external_presence_hints,
    ...result.warnings.map((warning) => `Worker warning: ${warning}`),
  ]);

  return {
    normalizedWebsite: result.website_used,
    pagesChecked,
    sourceUrls,
    supportingPageUrls,
    contactPageUrls,
    staffPageUrls,
    emails: dedupeStrings(result.emails_found),
    phones: dedupeStrings(result.phones_found),
    namedContacts: result.people_found.map((person) => ({
      fullName: person.full_name,
      title: person.title,
      sourceUrl: person.source_url,
    })),
    categoryClues: dedupeStrings(result.category_clues),
    evidenceSummary,
    descriptionSnippet: result.description_snippet,
    lastError:
      sourceUrls.length === 0
        ? result.errors[0] ?? result.warnings[0]
        : result.errors[0],
  };
}

async function scanWebsiteWithFallback(
  params: WebsiteEnrichmentScanParams,
  fallbackReason: string,
) {
  const fallback = await basicWebsiteEnrichmentProvider.scanWebsite(params);

  return {
    ...fallback,
    evidenceSummary: dedupeStrings([
      buildFallbackEvidenceMessage(fallbackReason),
      ...fallback.evidenceSummary,
    ]),
  } satisfies WebsiteScanResult;
}

export const scraplingWebsiteEnrichmentProvider: WebsiteEnrichmentProviderAdapter = {
  provider: "scrapling",
  async scanWebsite(params: WebsiteEnrichmentScanParams) {
    try {
      const result = await runScraplingWorker({
        website: params.website,
        preferred_page_urls: params.preferredPageUrls ?? [],
        likely_page_paths: [...DEFAULT_SCRAPLING_PAGE_PATHS],
      });

      return mapWorkerResultToWebsiteScanResult(result);
    } catch (error) {
      return scanWebsiteWithFallback(
        params,
        error instanceof Error
          ? error.message
          : "The Scrapling worker was unavailable, so the basic provider was used instead.",
      );
    }
  },
};
