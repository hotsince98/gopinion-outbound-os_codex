import { normalizeWebsiteUrl } from "@/lib/data/intake/validation";

export interface WebsiteNamedContactCandidate {
  fullName: string;
  title?: string;
  sourceUrl: string;
}

export interface WebsiteScanResult {
  normalizedWebsite?: string;
  pagesChecked: string[];
  sourceUrls: string[];
  emails: string[];
  phones: string[];
  namedContacts: WebsiteNamedContactCandidate[];
  categoryClues: string[];
  descriptionSnippet?: string;
  lastError?: string;
}

const PAGE_PATH_CANDIDATES = [
  "",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/staff",
] as const;

const ROLE_TITLE_PATTERN =
  /(owner|dealer principal|general manager|gm|sales manager|sales director|manager|founder|president|director)/i;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : undefined;
}

function getMetaDescription(html: string) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  );

  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : undefined;
}

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function extractEmails(text: string) {
  return dedupeStrings(text.match(EMAIL_PATTERN) ?? []).map((value) =>
    value.toLowerCase(),
  );
}

function extractPhones(text: string) {
  return dedupeStrings(text.match(PHONE_PATTERN) ?? [])
    .map((value) => value.trim())
    .filter((value) => normalizePhone(value).length >= 10);
}

function extractNamedContacts(
  text: string,
  sourceUrl: string,
): WebsiteNamedContactCandidate[] {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 120);

  const matches = lines.flatMap((line) => {
    const pairMatch = line.match(
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})\s*[-,|]\s*(.+)$/u,
    );
    if (pairMatch && ROLE_TITLE_PATTERN.test(pairMatch[2] ?? "")) {
      return [
        {
          fullName: pairMatch[1],
          title: pairMatch[2]?.trim(),
          sourceUrl,
        },
      ];
    }

    const reverseMatch = line.match(
      /^(.+?)\s*[-:|]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})$/u,
    );
    if (reverseMatch && ROLE_TITLE_PATTERN.test(reverseMatch[1] ?? "")) {
      return [
        {
          fullName: reverseMatch[2],
          title: reverseMatch[1]?.trim(),
          sourceUrl,
        },
      ];
    }

    return [];
  });

  const deduped = new Map<string, WebsiteNamedContactCandidate>();
  for (const match of matches) {
    deduped.set(match.fullName.toLowerCase(), match);
  }

  return [...deduped.values()];
}

function extractCategoryClues(text: string) {
  const normalized = text.toLowerCase();
  const matches: string[] = [];
  const clueMap: Array<[string, string]> = [
    ["buy here pay here", "Buy here pay here dealer"],
    ["pre-owned", "Pre-owned auto dealer"],
    ["used car", "Used car dealership"],
    ["auto sales", "Auto sales dealership"],
    ["truck dealer", "Truck dealership"],
    ["truck sales", "Truck dealership"],
    ["motorcycle dealer", "Motorcycle dealer"],
    ["powersports", "Powersports dealer"],
  ];

  for (const [pattern, label] of clueMap) {
    if (normalized.includes(pattern)) {
      matches.push(label);
    }
  }

  return dedupeStrings(matches);
}

function extractDescriptionSnippet(text: string, html: string) {
  const metaDescription = getMetaDescription(html);
  if (metaDescription) {
    return metaDescription;
  }

  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 60 && line.length < 240);

  return lines[0];
}

async function fetchHtmlPage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(4_000),
    headers: {
      "user-agent":
        "GoPinion Outbound OS enrichment bot (+https://gopinion.ai)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Unexpected content type ${contentType}`);
  }

  return await response.text();
}

function buildCandidateUrls(normalizedWebsite: string) {
  const homepageUrl = new URL(normalizedWebsite);

  return dedupeStrings(
    PAGE_PATH_CANDIDATES.map((path) => new URL(path, homepageUrl).toString()),
  );
}

export async function scanCompanyWebsite(
  website: string | undefined,
): Promise<WebsiteScanResult> {
  const normalizedWebsite = normalizeWebsiteUrl(website);
  if (!normalizedWebsite) {
    return {
      normalizedWebsite: undefined,
      pagesChecked: [],
      sourceUrls: [],
      emails: [],
      phones: [],
      namedContacts: [],
      categoryClues: [],
      lastError: "No valid website was available for enrichment.",
    };
  }

  const candidateUrls = buildCandidateUrls(normalizedWebsite);
  const settled = await Promise.allSettled(
    candidateUrls.map(async (url) => {
      const html = await fetchHtmlPage(url);
      const text = stripHtml(html);

      return {
        url,
        title: getTitle(html),
        descriptionSnippet: extractDescriptionSnippet(text, html),
        emails: extractEmails(`${html}\n${text}`),
        phones: extractPhones(text),
        namedContacts: extractNamedContacts(text, url),
        categoryClues: extractCategoryClues(
          [getTitle(html), getMetaDescription(html), text].filter(Boolean).join("\n"),
        ),
      };
    }),
  );

  const successfulPages = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const pageErrors = settled.flatMap((result) =>
    result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "Unknown fetch error"] : [],
  );

  return {
    normalizedWebsite,
    pagesChecked: candidateUrls,
    sourceUrls: successfulPages.map((page) => page.url),
    emails: dedupeStrings(successfulPages.flatMap((page) => page.emails)),
    phones: dedupeStrings(successfulPages.flatMap((page) => page.phones)),
    namedContacts: successfulPages.flatMap((page) => page.namedContacts),
    categoryClues: dedupeStrings(successfulPages.flatMap((page) => page.categoryClues)),
    descriptionSnippet: successfulPages.find((page) => page.descriptionSnippet)?.descriptionSnippet,
    lastError:
      successfulPages.length === 0
        ? pageErrors[0] ?? "No website pages could be fetched."
        : undefined,
  };
}
