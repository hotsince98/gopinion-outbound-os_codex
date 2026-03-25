import { deriveContactRoleFromTitle, normalizeWebsiteUrl } from "@/lib/data/intake/validation";
import type {
  CompanyNoteHint,
  Contact,
  SourceReference,
} from "@/lib/domain";

const EMAIL_PATTERN = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/g;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const WEBSITE_PATTERN =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,;]*)?)\b/gi;
const TITLE_PATTERN =
  /(owner|dealer principal|general manager|gm|sales manager|sales director|manager|founder|president|director)/i;

export interface ParsedNoteContactCandidate {
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  role: Contact["role"];
  confidenceScore: number;
  requiresReview: boolean;
  source: SourceReference;
  notes: string[];
}

export interface ParsedImportedNoteArtifacts {
  hints: CompanyNoteHint[];
  suggestedWebsite?: string;
  suggestedPhone?: string;
  candidateContacts: ParsedNoteContactCandidate[];
  observations: string[];
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/[^\d+]/g, "");
}

function buildImportedNotesSource(now: string): SourceReference {
  return {
    kind: "import",
    provider: "imported_notes",
    label: "Imported notes",
    observedAt: now,
  };
}

function extractEmails(line: string) {
  return dedupeStrings((line.match(EMAIL_PATTERN) ?? []).map((value) => value.toLowerCase()));
}

function extractPhones(line: string) {
  return dedupeStrings(line.match(PHONE_PATTERN) ?? []);
}

function extractWebsites(line: string) {
  return dedupeStrings(
    (line.match(WEBSITE_PATTERN) ?? [])
      .filter((candidate) => !candidate.includes("@"))
      .map((candidate) => normalizeWebsiteUrl(candidate))
      .filter((candidate): candidate is string => Boolean(candidate)),
  );
}

function extractNameTitlePair(line: string) {
  const pairMatch = line.match(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})\s*[-,|]\s*(.+)$/u,
  );

  if (pairMatch && TITLE_PATTERN.test(pairMatch[2] ?? "")) {
    return {
      fullName: pairMatch[1],
      title: pairMatch[2]?.trim(),
    };
  }

  const reverseMatch = line.match(
    /^(.+?)\s*[:\-|]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})$/u,
  );

  if (reverseMatch && TITLE_PATTERN.test(reverseMatch[1] ?? "")) {
    return {
      fullName: reverseMatch[2],
      title: reverseMatch[1]?.trim(),
    };
  }

  return undefined;
}

function buildObservationHints(
  lines: string[],
  structuredLines: Set<string>,
  source: SourceReference,
): CompanyNoteHint[] {
  return lines
    .filter((line) => !structuredLines.has(line) && line.length >= 18)
    .slice(0, 4)
    .map((line) => ({
      kind: "observation" as const,
      value: line,
      relatedValue: undefined,
      confidenceScore: 0.48,
      requiresReview: false,
      source,
    }));
}

export function parseImportedNoteArtifacts(
  noteLines: readonly string[] | undefined,
  now: string,
): ParsedImportedNoteArtifacts {
  const lines = dedupeStrings((noteLines ?? []).map((line) => line.trim()));
  const source = buildImportedNotesSource(now);
  const structuredLines = new Set<string>();
  const hints: CompanyNoteHint[] = [];
  const candidateContacts: ParsedNoteContactCandidate[] = [];
  const allPhones: string[] = [];
  const allWebsites: string[] = [];
  const allEmails: string[] = [];
  const nameTitlePairs: Array<{ fullName: string; title?: string }> = [];

  for (const line of lines) {
    const websites = extractWebsites(line);
    const emails = extractEmails(line);
    const phones = extractPhones(line);
    const nameTitle = extractNameTitlePair(line);
    const matchedStructuredValue =
      websites.length > 0 || emails.length > 0 || phones.length > 0 || Boolean(nameTitle);

    if (matchedStructuredValue) {
      structuredLines.add(line);
    }

    for (const website of websites) {
      allWebsites.push(website);
      hints.push({
        kind: "website",
        value: website,
        confidenceScore: line.includes("http") ? 0.82 : 0.7,
        requiresReview: !line.includes("http"),
        source,
      });
    }

    for (const email of emails) {
      allEmails.push(email);
      hints.push({
        kind: "email",
        value: email,
        confidenceScore: 0.74,
        requiresReview: true,
        source,
      });
    }

    for (const phone of phones) {
      allPhones.push(phone);
      hints.push({
        kind: "phone",
        value: phone,
        confidenceScore: 0.62,
        requiresReview: true,
        source,
      });
    }

    if (nameTitle) {
      nameTitlePairs.push(nameTitle);
      hints.push({
        kind: "contact_name",
        value: nameTitle.fullName,
        relatedValue: nameTitle.title,
        confidenceScore: 0.64,
        requiresReview: true,
        source,
      });

      if (nameTitle.title) {
        hints.push({
          kind: "contact_title",
          value: nameTitle.title,
          relatedValue: nameTitle.fullName,
          confidenceScore: 0.58,
          requiresReview: true,
          source,
        });
      }
    }

    if (emails.length || phones.length || nameTitle) {
      candidateContacts.push({
        fullName: nameTitle?.fullName,
        title: nameTitle?.title,
        email: emails[0],
        phone: phones[0],
        role: deriveContactRoleFromTitle(nameTitle?.title),
        confidenceScore: nameTitle && emails[0] ? 0.74 : nameTitle || emails[0] ? 0.62 : 0.54,
        requiresReview: true,
        source,
        notes: [`Imported notes line: ${line}`],
      });
    }
  }

  if (candidateContacts.length === 0 && (allEmails[0] || allPhones[0])) {
    candidateContacts.push({
      fullName: nameTitlePairs[0]?.fullName,
      title: nameTitlePairs[0]?.title,
      email: allEmails[0],
      phone: allPhones[0],
      role: deriveContactRoleFromTitle(nameTitlePairs[0]?.title),
      confidenceScore: allEmails[0] ? 0.58 : 0.5,
      requiresReview: true,
      source,
      notes: ["Imported notes surfaced a possible outreach path."],
    });
  }

  const observationHints = buildObservationHints(lines, structuredLines, source);

  return {
    hints: [
      ...hints,
      ...observationHints,
    ].filter(
      (hint, index, collection) =>
        collection.findIndex(
          (current) =>
            current.kind === hint.kind &&
            current.value === hint.value &&
            current.relatedValue === hint.relatedValue,
        ) === index,
    ),
    suggestedWebsite: allWebsites[0],
    suggestedPhone: allPhones[0],
    candidateContacts: candidateContacts.filter(
      (candidate, index, collection) =>
        collection.findIndex(
          (current) =>
            current.email === candidate.email &&
            normalizePhone(current.phone) === normalizePhone(candidate.phone) &&
            current.fullName === candidate.fullName &&
            current.title === candidate.title,
        ) === index,
    ),
    observations: observationHints.map((hint) => hint.value),
  };
}
