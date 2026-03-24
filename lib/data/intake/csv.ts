import type {
  CsvLeadColumnMapping,
  CsvLeadPreview,
  CsvLeadPreviewRow,
  LeadIntakeInput,
} from "@/lib/domain";
import {
  getLeadIntakeIssueMessages,
  normalizeLeadIntakeInput,
  validateLeadIntakeInput,
} from "@/lib/data/intake/validation";

type CsvFieldKey =
  | keyof Omit<LeadIntakeInput, "industryKey" | "sourceKind">
  | "industry"
  | "address"
  | "phone";

interface CsvFieldDefinition {
  key: CsvFieldKey;
  label: string;
  aliases: string[];
}

interface MatchedCsvField {
  definition: CsvFieldDefinition;
  header: string;
  index: number;
  strategy: CsvLeadColumnMapping["strategy"];
  note?: string;
}

export interface ParsedLeadCsvRow {
  rowNumber: number;
  input: LeadIntakeInput;
  issues: string[];
}

export interface ParsedLeadCsv {
  detectedColumns: string[];
  mappedColumns: string[];
  columnMappings: CsvLeadColumnMapping[];
  warnings: string[];
  rows: ParsedLeadCsvRow[];
}

const csvFieldDefinitions: CsvFieldDefinition[] = [
  {
    key: "companyName",
    label: "Company name",
    aliases: ["companyname", "company", "dealer", "businessname", "business"],
  },
  {
    key: "website",
    label: "Website",
    aliases: ["website", "url", "domain", "site"],
  },
  {
    key: "address",
    label: "Address / location",
    aliases: ["address", "streetaddress", "fulladdress", "location"],
  },
  {
    key: "phone",
    label: "Phone",
    aliases: ["phone", "phonenumber", "telephone", "mobile"],
  },
  {
    key: "industry",
    label: "Industry",
    aliases: ["industry", "vertical"],
  },
  {
    key: "subindustry",
    label: "Subindustry",
    aliases: ["subindustry", "subcategory", "segment", "category"],
  },
  {
    key: "city",
    label: "City",
    aliases: ["city", "marketcity"],
  },
  {
    key: "state",
    label: "State",
    aliases: ["state", "province", "region"],
  },
  {
    key: "country",
    label: "Country",
    aliases: ["country"],
  },
  {
    key: "googleRating",
    label: "Google rating",
    aliases: ["googlerating", "rating", "google_score"],
  },
  {
    key: "reviewCount",
    label: "Review count",
    aliases: ["reviewcount", "reviews", "google_reviews"],
  },
  {
    key: "primaryContactName",
    label: "Primary contact name",
    aliases: ["primarycontactname", "contactname", "contact_full_name"],
  },
  {
    key: "contactTitle",
    label: "Contact title",
    aliases: ["contacttitle", "title", "contact_role"],
  },
  {
    key: "contactEmail",
    label: "Contact email",
    aliases: ["contactemail", "email", "contact_email", "emails", "emailaddress"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "note", "comments"],
  },
];

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseCsvCells(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function buildHeaderIndex(headers: string[]) {
  const headerIndex = new Map<string, number>();

  headers.forEach((header, index) => {
    headerIndex.set(normalizeCsvHeader(header), index);
  });

  return headerIndex;
}

function findColumnIndex(
  headerIndex: Map<string, number>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const match = headerIndex.get(alias);
    if (match != null) {
      return match;
    }
  }

  return undefined;
}

function getFieldMatch(
  matchedFields: MatchedCsvField[],
  key: CsvFieldKey,
) {
  return matchedFields.find((field) => field.definition.key === key);
}

function extractEmails(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      (value.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/g) ?? []).map((email) =>
        email.toLowerCase(),
      ),
    ),
  );
}

function extractStateOrRegion(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/[A-Za-z]{2,}(?:\s+[A-Za-z]{2,})?/);

  return match?.[0]?.trim();
}

function normalizeCountry(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  if (["us", "usa", "united states", "united states of america"].includes(trimmed)) {
    return "US";
  }

  if (["can", "canada"].includes(trimmed)) {
    return "Canada";
  }

  return undefined;
}

function parseAddressParts(address: string | undefined) {
  const trimmed = address?.trim();

  if (!trimmed) {
    return {};
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return {
      city: "Unknown",
      state: "Unknown",
      country: "US",
      warning:
        "Address column was detected, but the city/state could not be parsed automatically.",
    };
  }

  let country = normalizeCountry(parts[parts.length - 1]);
  let workingParts = parts;

  if (country) {
    workingParts = parts.slice(0, -1);
  } else {
    country = "US";
  }

  const city = workingParts[workingParts.length - 2]?.trim();
  const state = extractStateOrRegion(workingParts[workingParts.length - 1]);

  if (city && state) {
    return {
      city,
      state,
      country,
    };
  }

  return {
    city: city ?? "Unknown",
    state: state ?? "Unknown",
    country,
    warning:
      "Address column was detected, but part of the city/state mapping is still ambiguous.",
  };
}

function appendNoteLines(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join("\n");
}

function normalizeBusinessCategory(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function countHeaders(
  headers: string[],
  aliases: string[],
) {
  const normalizedHeaders = headers.map(normalizeCsvHeader);

  return aliases.filter((alias) => normalizedHeaders.includes(alias)).length;
}

function shouldTreatNameAsCompany(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeCsvHeader);

  if (!normalizedHeaders.includes("name")) {
    return false;
  }

  const businessSignals = countHeaders(headers, [
    "address",
    "streetaddress",
    "fulladdress",
    "location",
    "website",
    "url",
    "domain",
    "phone",
    "phonenumber",
    "telephone",
    "emails",
    "category",
    "industry",
  ]);
  const personSignals = countHeaders(headers, [
    "firstname",
    "lastname",
    "fullname",
    "contactname",
    "primarycontactname",
    "email",
    "contactemail",
    "contacttitle",
  ]);

  return businessSignals >= 2 || (businessSignals >= 1 && personSignals === 0);
}

function buildMatchedFields(headers: string[]) {
  const headerIndex = buildHeaderIndex(headers);
  const matchedFields = csvFieldDefinitions.reduce<MatchedCsvField[]>(
    (accumulator, definition) => {
      const index = findColumnIndex(headerIndex, definition.aliases);

      if (index == null) {
        return accumulator;
      }

      accumulator.push({
        definition,
        header: headers[index] ?? definition.label,
        index,
        strategy: "direct" as const,
      });

      return accumulator;
    },
    [],
  );
  const warnings: string[] = [];

  if (!getFieldMatch(matchedFields, "companyName")) {
    const nameIndex = headerIndex.get("name");

    if (nameIndex != null) {
      if (shouldTreatNameAsCompany(headers)) {
        matchedFields.push({
          definition: {
            key: "companyName",
            label: "Company name",
            aliases: ["name"],
          },
          header: headers[nameIndex] ?? "Name",
          index: nameIndex,
          strategy: "inferred",
          note:
            "Treated `Name` as the company because the file looks like a business list.",
        });
      } else {
        warnings.push(
          "`Name` was detected, but the file is ambiguous. Add `company name` or confirm the mapping from the preview before importing.",
        );
      }
    }
  }

  return {
    matchedFields,
    warnings,
  };
}

export function parseLeadCsvText(text: string): ParsedLeadCsv {
  const rows = parseCsvCells(text);
  if (rows.length === 0) {
    return {
      detectedColumns: [],
      mappedColumns: [],
      columnMappings: [],
      warnings: [],
      rows: [],
    };
  }

  const [headerRow, ...dataRows] = rows;
  const { matchedFields, warnings } = buildMatchedFields(headerRow);
  const collectedWarnings = [...warnings];
  const fieldMatches = Object.fromEntries(
    matchedFields.map((field) => [field.definition.key, field]),
  ) as Partial<Record<CsvFieldKey, MatchedCsvField>>;
  const columnMappings = headerRow.map((header) => {
    const matchedField = matchedFields.find((field) => field.header === header);

    return {
      header,
      mappedField: matchedField?.definition.label ?? "Unmapped",
      strategy: matchedField?.strategy ?? "unmapped",
      note: matchedField?.note,
    } satisfies CsvLeadColumnMapping;
  });

  return {
    detectedColumns: headerRow,
    mappedColumns: matchedFields.map(
      (field) => `${field.header} -> ${field.definition.label}`,
    ),
    columnMappings,
    warnings: collectedWarnings,
    rows: dataRows.map((row, rowIndex) => {
      const rawAddress = row[fieldMatches.address?.index ?? -1];
      const rawPhone = row[fieldMatches.phone?.index ?? -1];
      const rawEmails = row[fieldMatches.contactEmail?.index ?? -1];
      const rawIndustry = row[fieldMatches.industry?.index ?? -1];
      const rawSubindustry = row[fieldMatches.subindustry?.index ?? -1];
      const addressParts = parseAddressParts(rawAddress);
      const parsedEmails = extractEmails(rawEmails);
      const preservedNotes = appendNoteLines(
        row[fieldMatches.notes?.index ?? -1],
        rawAddress ? `Address: ${rawAddress}` : undefined,
        rawPhone ? `Phone: ${rawPhone}` : undefined,
        parsedEmails.length > 1 ? `Emails: ${parsedEmails.join(", ")}` : undefined,
      );
      if (addressParts.warning) {
        collectedWarnings.push(`Row ${rowIndex + 2}: ${addressParts.warning}`);
      }
      const input = normalizeLeadIntakeInput(
        {
          companyName:
            row[fieldMatches.companyName?.index ?? -1],
          website:
            row[fieldMatches.website?.index ?? -1],
          subindustry: normalizeBusinessCategory(rawSubindustry || rawIndustry),
          city:
            row[fieldMatches.city?.index ?? -1] || addressParts.city,
          state:
            row[fieldMatches.state?.index ?? -1] || addressParts.state,
          country:
            row[fieldMatches.country?.index ?? -1] || addressParts.country,
          googleRating:
            row[fieldMatches.googleRating?.index ?? -1],
          reviewCount:
            row[fieldMatches.reviewCount?.index ?? -1],
          primaryContactName:
            row[fieldMatches.primaryContactName?.index ?? -1],
          contactTitle:
            row[fieldMatches.contactTitle?.index ?? -1],
          contactEmail: parsedEmails[0],
          notes: preservedNotes,
        },
        "csv",
      );

      return {
        rowNumber: rowIndex + 2,
        input,
        issues: getLeadIntakeIssueMessages(validateLeadIntakeInput(input)),
      };
    }),
  };
}

function buildPreviewRow(row: ParsedLeadCsvRow): CsvLeadPreviewRow {
  return {
    rowNumber: row.rowNumber,
    companyName: row.input.companyName || "Unnamed company",
    website: row.input.website,
    marketLabel: [row.input.city, row.input.state].filter(Boolean).join(", ") || "Market pending",
    contactLabel:
      [row.input.primaryContactName, row.input.contactTitle, row.input.contactEmail]
        .filter(Boolean)
        .join(" • ") || "No contact provided",
    issues: row.issues,
  };
}

export function buildLeadCsvPreview(parsed: ParsedLeadCsv): CsvLeadPreview {
  const validRows = parsed.rows.filter((row) => row.issues.length === 0).length;

  return {
    totalRows: parsed.rows.length,
    validRows,
    invalidRows: parsed.rows.length - validRows,
    detectedColumns: parsed.detectedColumns,
    mappedColumns: parsed.mappedColumns,
    columnMappings: parsed.columnMappings,
    warnings: parsed.warnings,
    rows: parsed.rows.slice(0, 6).map(buildPreviewRow),
  };
}
