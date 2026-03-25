import type {
  ContactRole,
  LeadIntakeFieldErrors,
  LeadIntakeInput,
} from "@/lib/domain";

const WEBSITE_PROTOCOL_PATTERN = /^[a-z]+:\/\//i;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimToUndefined(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function parseOptionalNumber(value: string | number | undefined) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function normalizeWebsiteUrl(value: string | undefined) {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  const withProtocol = WEBSITE_PROTOCOL_PATTERN.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

    return `${url.protocol}//${url.host.toLowerCase()}${pathname}`;
  } catch {
    return undefined;
  }
}

export function normalizeEmailAddress(value: string | undefined) {
  const trimmed = trimToUndefined(value);

  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function splitIntakeNotes(notes: string | undefined) {
  return (notes ?? "")
    .split(/\r?\n+/)
    .map((note) => note.trim())
    .filter(Boolean);
}

export function hasContactInput(input: LeadIntakeInput) {
  return Boolean(
    input.primaryContactName || input.contactTitle || input.contactEmail,
  );
}

export function deriveContactRoleFromTitle(
  title: string | undefined,
): ContactRole {
  const normalized = title?.toLowerCase() ?? "";

  if (normalized.includes("operator") && normalized.includes("owner")) {
    return "operator_owner";
  }

  if (normalized.includes("owner")) {
    return "owner";
  }

  if (normalized.includes("general manager") || normalized === "gm") {
    return "general_manager";
  }

  if (normalized.includes("sales manager")) {
    return "sales_manager";
  }

  if (normalized.includes("manager")) {
    return "dealership_manager";
  }

  return "unknown";
}

export function normalizeLeadIntakeInput(
  values: Partial<
    Record<
      | keyof LeadIntakeInput
      | "companyName"
      | "website"
      | "industryKey"
      | "subindustry"
      | "streetAddress"
      | "city"
      | "state"
      | "postalCode"
      | "country"
      | "phone"
      | "googleRating"
      | "reviewCount"
      | "primaryContactName"
      | "contactTitle"
      | "contactEmail"
      | "notes",
      string | number | undefined
    >
  >,
  sourceKind: LeadIntakeInput["sourceKind"],
): LeadIntakeInput {
  return {
    companyName: values.companyName?.toString().trim() ?? "",
    website: trimToUndefined(values.website?.toString()),
    industryKey: "independent_used_car_dealer",
    subindustry: trimToUndefined(values.subindustry?.toString()),
    streetAddress: trimToUndefined(values.streetAddress?.toString()),
    city: values.city?.toString().trim() ?? "",
    state: values.state?.toString().trim() ?? "",
    postalCode: trimToUndefined(values.postalCode?.toString()),
    country: values.country?.toString().trim() || "US",
    phone: trimToUndefined(values.phone?.toString()),
    googleRating: parseOptionalNumber(values.googleRating),
    reviewCount: parseOptionalNumber(values.reviewCount),
    primaryContactName: trimToUndefined(values.primaryContactName?.toString()),
    contactTitle: trimToUndefined(values.contactTitle?.toString()),
    contactEmail: normalizeEmailAddress(values.contactEmail?.toString()),
    notes: trimToUndefined(values.notes?.toString()),
    sourceKind,
  };
}

export function validateLeadIntakeInput(
  input: LeadIntakeInput,
): LeadIntakeFieldErrors {
  const fieldErrors: LeadIntakeFieldErrors = {};

  if (!input.companyName) {
    fieldErrors.companyName = "Company name is required.";
  }

  if (!input.city) {
    fieldErrors.city = "City is required.";
  }

  if (!input.state) {
    fieldErrors.state = "State or province is required.";
  }

  if (!input.country) {
    fieldErrors.country = "Country is required.";
  }

  if (input.website && !normalizeWebsiteUrl(input.website)) {
    fieldErrors.website = "Website must be a valid URL.";
  }

  if (
    input.contactEmail &&
    !BASIC_EMAIL_PATTERN.test(input.contactEmail)
  ) {
    fieldErrors.contactEmail = "Contact email must be valid.";
  }

  if (input.googleRating != null) {
    if (Number.isNaN(input.googleRating)) {
      fieldErrors.googleRating = "Google rating must be a number.";
    } else if (input.googleRating < 0 || input.googleRating > 5) {
      fieldErrors.googleRating = "Google rating must be between 0 and 5.";
    }
  }

  if (input.reviewCount != null) {
    if (Number.isNaN(input.reviewCount)) {
      fieldErrors.reviewCount = "Review count must be a number.";
    } else if (!Number.isInteger(input.reviewCount) || input.reviewCount < 0) {
      fieldErrors.reviewCount = "Review count must be a whole number.";
    }
  }

  return fieldErrors;
}

export function getLeadIntakeIssueMessages(
  fieldErrors: LeadIntakeFieldErrors,
) {
  return Object.values(fieldErrors).filter(
    (value): value is string => Boolean(value),
  );
}

export function normalizeCompanyNameForComparison(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
