export const supportingPageKinds = [
  "homepage",
  "contact",
  "about",
  "staff",
] as const;
export type SupportingPageKind = (typeof supportingPageKinds)[number];

export interface SupportingPageCandidate {
  url: string;
  kind: Exclude<SupportingPageKind, "homepage">;
  reason: string;
  score: number;
}

const STAFF_PATH_PATTERNS = [
  /\/staff(?:[/.?#-]|$)/i,
  /\/team(?:[/.?#-]|$)/i,
  /meet[-_/]?our[-_/]?(?:team|staff)/i,
  /meet[-_/]?the[-_/]?(?:team|staff)/i,
  /our[-_/]?(?:team|staff)/i,
  /sales[-_/]?(?:team|staff)/i,
  /service[-_/]?(?:team|staff)/i,
  /parts[-_/]?(?:team|staff)/i,
  /finance[-_/]?(?:team|staff)/i,
  /staff[-_/]?directory/i,
  /team[-_/]?directory/i,
  /\/departments?(?:[/.?#-]|$)/i,
  /\/management(?:[/.?#-]|$)/i,
  /management[-_/]?team/i,
  /leadership/i,
  /our[-_/]?people/i,
  /people/i,
];

const CONTACT_PATH_PATTERNS = [
  /\/contact(?:[/.?#-]|$)/i,
  /contact[-_/]?us/i,
  /hours[-_/]?(?:and[-_/]?)?directions/i,
  /\/directions(?:[/.?#-]|$)/i,
  /visit[-_/]?us/i,
];

const ABOUT_PATH_PATTERNS = [
  /\/about(?:[/.?#-]|$)/i,
  /about[-_/]?us/i,
  /our[-_/]?story/i,
  /who[-_/]?we[-_/]?are/i,
  /why[-_/]?buy[-_/]?from[-_/]?us/i,
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeText(value: string | undefined) {
  return decodeHtmlEntities(value ?? "").trim().toLowerCase();
}

function resolveSameHostUrl(baseUrl: string, rawHref: string) {
  if (!rawHref || rawHref.startsWith("#")) {
    return undefined;
  }

  const trimmed = rawHref.trim();

  if (
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  ) {
    return undefined;
  }

  try {
    const base = new URL(baseUrl);
    const resolved = new URL(trimmed, base);

    if (resolved.hostname !== base.hostname) {
      return undefined;
    }

    resolved.hash = "";

    const pathname = resolved.pathname === "/" ? "" : resolved.pathname.replace(/\/+$/, "");

    return `${resolved.protocol}//${resolved.host.toLowerCase()}${pathname}${resolved.search}`;
  } catch {
    return undefined;
  }
}

export function classifySupportingPageCandidate(params: {
  href?: string;
  text?: string;
}): SupportingPageCandidate["kind"] | undefined {
  const href = normalizeText(params.href);
  const text = normalizeText(params.text);
  const haystack = `${href} ${text}`;

  if (STAFF_PATH_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "staff";
  }

  if (CONTACT_PATH_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "contact";
  }

  if (ABOUT_PATH_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "about";
  }

  return undefined;
}

function getClassificationScore(
  kind: SupportingPageCandidate["kind"],
  href: string,
  text: string,
) {
  const haystack = `${href} ${text}`;

  switch (kind) {
    case "staff":
      return /meet[-_/]?(?:our|the)[-_/]?(?:team|staff)|staff|team/i.test(haystack)
        ? 96
        : 88;
    case "contact":
      return /contact|hours|directions|visit/i.test(haystack) ? 84 : 76;
    case "about":
      return /about|story|who we are/i.test(haystack) ? 70 : 64;
  }
}

export function extractLikelyInternalPageCandidates(
  html: string,
  baseUrl: string,
  limit = 10,
): SupportingPageCandidate[] {
  const candidates = new Map<string, SupportingPageCandidate>();
  const anchorPattern =
    /<a[^>]+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = match[1] ?? match[2] ?? match[3] ?? "";
    const text = decodeHtmlEntities(match[4]?.replace(/<[^>]+>/g, " ") ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const kind = classifySupportingPageCandidate({ href, text });

    if (!kind) {
      continue;
    }

    const resolvedUrl = resolveSameHostUrl(baseUrl, href);

    if (!resolvedUrl) {
      continue;
    }

    const score = getClassificationScore(kind, href, text);
    const reason = text
      ? `${kind === "staff" ? "Staff/team" : kind} link from site navigation: ${text}`
      : `${kind === "staff" ? "Staff/team" : kind} page matched from public site navigation`;
    const existing = candidates.get(resolvedUrl);

    if (!existing || score > existing.score) {
      candidates.set(resolvedUrl, {
        url: resolvedUrl,
        kind,
        reason,
        score,
      });
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function getSupportingPageUrlsByKind(
  candidates: readonly SupportingPageCandidate[],
  kind: Exclude<SupportingPageKind, "homepage">,
) {
  return dedupeStrings(
    candidates.filter((candidate) => candidate.kind === kind).map((candidate) => candidate.url),
  );
}
