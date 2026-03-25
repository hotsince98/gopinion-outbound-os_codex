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
  | "phone"
  | "postalCode";

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
    aliases: ["phone", "phonenumber", "telephone", "mobile", "phoneno"],
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
    key: "postalCode",
    label: "ZIP / postal code",
    aliases: ["zip", "zipcode", "postalcode", "postcode"],
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
    aliases: ["reviewcount", "reviews", "google_reviews", "numberofreviews"],
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
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function trimToUndefined(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function readCell(row: string[], index: number | undefined) {
  if (index == null || index < 0) {
    return undefined;
  }

  return trimToUndefined(row[index]);
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
  const trimmed = trimToUndefined(value);
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
  const trimmed = trimToUndefined(address);

  if (!trimmed) {
    return {};
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return {};
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
    city,
    state,
    country,
  };
}

function appendNoteLines(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join("\n");
}

function normalizeBusinessCategory(value: string | undefined) {
  const trimmed = trimToUndefined(value);

  return trimmed ? trimmed : undefined;
}

function buildLocationFields(params: {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}) {
  const explicitCity = trimToUndefined(params.city);
  const explicitState = trimToUndefined(params.state);
  const explicitCountry =
    normalizeCountry(params.country) ?? trimToUndefined(params.country);
  const shouldParseAddress =
    Boolean(params.address) &&
    (!explicitCity || !explicitState || !explicitCountry);
  const parsedAddress = shouldParseAddress
    ? parseAddressParts(params.address)
    : {};
  const city = explicitCity ?? parsedAddress.city;
  const state = explicitState ?? parsedAddress.state;
  const country = explicitCountry ?? parsedAddress.country ?? "US";
  const marketLabel = [
    city,
    [state, trimToUndefined(params.postalCode)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    city,
    state,
    country,
    locationLine: [trimToUndefined(params.address), marketLabel]
      .filter(Boolean)
      .join(", "),
    warning:
      !explicitCity && !explicitState && params.address && (!city || !state)
        ? "Address column was detected, but the city/state could not be parsed automatically."
        : undefined,
  };
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
      const rawAddress = readCell(row, fieldMatches.address?.index);
      const rawCity = readCell(row, fieldMatches.city?.index);
      const rawState = readCell(row, fieldMatches.state?.index);
      const rawPostalCode = readCell(row, fieldMatches.postalCode?.index);
      const rawCountry = readCell(row, fieldMatches.country?.index);
      const rawPhone = readCell(row, fieldMatches.phone?.index);
      const rawEmails = readCell(row, fieldMatches.contactEmail?.index);
      const rawIndustry = readCell(row, fieldMatches.industry?.index);
      const rawSubindustry = readCell(row, fieldMatches.subindustry?.index);
      const locationFields = buildLocationFields({
        address: rawAddress,
        city: rawCity,
        state: rawState,
        country: rawCountry,
        postalCode: rawPostalCode,
      });
      const parsedEmails = extractEmails(rawEmails);
      const preservedNotes = appendNoteLines(
        readCell(row, fieldMatches.notes?.index),
        rawAddress ? `Address: ${rawAddress}` : undefined,
        locationFields.locationLine
          ? `Location: ${locationFields.locationLine}`
          : undefined,
        rawPhone ? `Phone: ${rawPhone}` : undefined,
        parsedEmails.length > 1 ? `Emails: ${parsedEmails.join(", ")}` : undefined,
      );
      if (locationFields.warning) {
        collectedWarnings.push(`Row ${rowIndex + 2}: ${locationFields.warning}`);
      }
      const input = normalizeLeadIntakeInput(
        {
          companyName: readCell(row, fieldMatches.companyName?.index),
          website: readCell(row, fieldMatches.website?.index),
          subindustry: normalizeBusinessCategory(rawSubindustry || rawIndustry),
          city: locationFields.city,
          state: locationFields.state,
          country: locationFields.country,
          googleRating: readCell(row, fieldMatches.googleRating?.index),
          reviewCount: readCell(row, fieldMatches.reviewCount?.index),
          primaryContactName: readCell(row, fieldMatches.primaryContactName?.index),
          contactTitle: readCell(row, fieldMatches.contactTitle?.index),
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
