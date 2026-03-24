import type {
  CsvLeadPreview,
  CsvLeadPreviewRow,
  LeadIntakeInput,
} from "@/lib/domain";
import {
  getLeadIntakeIssueMessages,
  normalizeLeadIntakeInput,
  validateLeadIntakeInput,
} from "@/lib/data/intake/validation";

interface CsvFieldDefinition {
  key: keyof Omit<LeadIntakeInput, "industryKey" | "sourceKind"> | "industry";
  label: string;
  aliases: string[];
}

export interface ParsedLeadCsvRow {
  rowNumber: number;
  input: LeadIntakeInput;
  issues: string[];
}

export interface ParsedLeadCsv {
  detectedColumns: string[];
  mappedColumns: string[];
  rows: ParsedLeadCsvRow[];
}

const csvFieldDefinitions: CsvFieldDefinition[] = [
  {
    key: "companyName",
    label: "Company name",
    aliases: ["companyname", "company", "dealer", "businessname"],
  },
  {
    key: "website",
    label: "Website",
    aliases: ["website", "url", "domain", "site"],
  },
  {
    key: "industry",
    label: "Industry",
    aliases: ["industry", "vertical"],
  },
  {
    key: "subindustry",
    label: "Subindustry",
    aliases: ["subindustry", "subcategory", "segment"],
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
    aliases: ["contactemail", "email", "contact_email"],
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

export function parseLeadCsvText(text: string): ParsedLeadCsv {
  const rows = parseCsvCells(text);
  if (rows.length === 0) {
    return {
      detectedColumns: [],
      mappedColumns: [],
      rows: [],
    };
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndex = buildHeaderIndex(headerRow);
  const matchedFields = csvFieldDefinitions
    .map((definition) => ({
      definition,
      index: findColumnIndex(headerIndex, definition.aliases),
    }))
    .filter((field) => field.index != null);

  return {
    detectedColumns: headerRow,
    mappedColumns: matchedFields.map((field) => field.definition.label),
    rows: dataRows.map((row, rowIndex) => {
      const input = normalizeLeadIntakeInput(
        {
          companyName:
            row[
              matchedFields.find((field) => field.definition.key === "companyName")
                ?.index ?? -1
            ],
          website:
            row[
              matchedFields.find((field) => field.definition.key === "website")
                ?.index ?? -1
            ],
          subindustry:
            row[
              matchedFields.find((field) => field.definition.key === "subindustry")
                ?.index ?? -1
            ],
          city:
            row[
              matchedFields.find((field) => field.definition.key === "city")
                ?.index ?? -1
            ],
          state:
            row[
              matchedFields.find((field) => field.definition.key === "state")
                ?.index ?? -1
            ],
          country:
            row[
              matchedFields.find((field) => field.definition.key === "country")
                ?.index ?? -1
            ],
          googleRating:
            row[
              matchedFields.find((field) => field.definition.key === "googleRating")
                ?.index ?? -1
            ],
          reviewCount:
            row[
              matchedFields.find((field) => field.definition.key === "reviewCount")
                ?.index ?? -1
            ],
          primaryContactName:
            row[
              matchedFields.find(
                (field) => field.definition.key === "primaryContactName",
              )?.index ?? -1
            ],
          contactTitle:
            row[
              matchedFields.find((field) => field.definition.key === "contactTitle")
                ?.index ?? -1
            ],
          contactEmail:
            row[
              matchedFields.find((field) => field.definition.key === "contactEmail")
                ?.index ?? -1
            ],
          notes:
            row[
              matchedFields.find((field) => field.definition.key === "notes")
                ?.index ?? -1
            ],
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
    rows: parsed.rows.slice(0, 6).map(buildPreviewRow),
  };
}
