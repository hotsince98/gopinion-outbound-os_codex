import type {
  ContactRole,
  LeadIntakeFieldErrors,
  LeadIntakeInput,
  LeadIntakeRecentReviewInput,
  LatestReviewResponseStatus,
} from "@/lib/domain";

const WEBSITE_PROTOCOL_PATTERN = /^[a-z]+:\/\//i;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const WEBSITE_PUNYCODE_TLD_PATTERN = /^xn--[a-z0-9-]{2,59}$/i;
const WEBSITE_ALPHA_TLD_PATTERN = /^[a-z]{2,24}$/i;
const IPV4_HOST_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const RESERVED_WEBSITE_HOSTNAMES = new Set([
  "localhost",
  "html",
  "http",
  "https",
  "www",
]);
export const MAX_LEAD_RECENT_REVIEWS = 3;

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

function parseOptionalIsoDate(value: string | undefined) {
  const trimmed = trimToUndefined(value);

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed.toISOString();
}

function normalizeLatestReviewResponseStatus(
  value: string | number | undefined,
): LatestReviewResponseStatus | undefined {
  const normalized = trimToUndefined(value?.toString())
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case undefined:
      return undefined;
    case "responded":
    case "response_posted":
      return "responded";
    case "not_responded":
    case "no_response":
    case "none":
    case "unanswered":
      return "not_responded";
    default:
      return "unknown";
  }
}

function normalizeRecentReviewInput(
  values:
    | Partial<
        Record<
          keyof LeadIntakeRecentReviewInput,
          string | number | undefined
        >
      >
    | undefined,
): LeadIntakeRecentReviewInput | undefined {
  if (!values) {
    return undefined;
  }

  const snippet = trimToUndefined(values.snippet?.toString());
  const rating = parseOptionalNumber(values.rating);
  const author = trimToUndefined(values.author?.toString());
  const publishedAtInput = values.publishedAt?.toString();
  const normalizedPublishedAt = parseOptionalIsoDate(publishedAtInput);
  const publishedAt =
    normalizedPublishedAt === "invalid"
      ? publishedAtInput?.trim()
      : normalizedPublishedAt;
  const responseStatus = normalizeLatestReviewResponseStatus(values.responseStatus);

  if (
    !snippet &&
    rating == null &&
    !author &&
    !publishedAt &&
    responseStatus == null
  ) {
    return undefined;
  }

  return {
    snippet,
    rating,
    author,
    publishedAt,
    responseStatus,
  } satisfies LeadIntakeRecentReviewInput;
}

function buildLegacyRecentReviewInput(values: Partial<Record<
  | "latestReviewSnippet"
  | "latestReviewRating"
  | "latestReviewAuthor"
  | "latestReviewDate"
  | "latestReviewResponseStatus",
  string | number | undefined
>>) {
  return normalizeRecentReviewInput({
    snippet: values.latestReviewSnippet,
    rating: values.latestReviewRating,
    author: values.latestReviewAuthor,
    publishedAt: values.latestReviewDate,
    responseStatus: values.latestReviewResponseStatus,
  });
}

export function normalizeLeadIntakeRecentReviews(
  reviews:
    | Array<
        Partial<
          Record<
            keyof LeadIntakeRecentReviewInput,
            string | number | undefined
          >
        >
      >
    | undefined,
) {
  if (!reviews?.length) {
    return undefined;
  }

  const normalized = reviews
    .map((review) => normalizeRecentReviewInput(review))
    .filter(
      (review): review is LeadIntakeRecentReviewInput => review !== undefined,
    )
    .slice(0, MAX_LEAD_RECENT_REVIEWS);

  return normalized.length > 0 ? normalized : undefined;
}

export function getLeadIntakeRecentReviews(input: LeadIntakeInput) {
  if (input.recentReviews?.length) {
    return input.recentReviews.slice(0, MAX_LEAD_RECENT_REVIEWS);
  }

  const legacyReview = buildLegacyRecentReviewInput({
    latestReviewSnippet: input.latestReviewSnippet,
    latestReviewRating: input.latestReviewRating,
    latestReviewAuthor: input.latestReviewAuthor,
    latestReviewDate: input.latestReviewDate,
    latestReviewResponseStatus: input.latestReviewResponseStatus,
  });

  return legacyReview ? [legacyReview] : [];
}

function isValidIpv4Hostname(hostname: string) {
  if (!IPV4_HOST_PATTERN.test(hostname)) {
    return false;
  }

  return hostname.split(".").every((segment) => {
    const value = Number(segment);

    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

export function isPlausiblePublicWebsiteHostname(hostname: string | undefined) {
  const normalizedHostname = hostname?.trim().toLowerCase().replace(/\.+$/, "");

  if (!normalizedHostname || RESERVED_WEBSITE_HOSTNAMES.has(normalizedHostname)) {
    return false;
  }

  if (isValidIpv4Hostname(normalizedHostname)) {
    return true;
  }

  const labels = normalizedHostname.split(".");

  if (labels.length < 2) {
    return false;
  }

  if (
    !labels.every((label) => WEBSITE_HOST_LABEL_PATTERN.test(label)) ||
    labels.some((label) => label.startsWith("-") || label.endsWith("-"))
  ) {
    return false;
  }

  const topLevelDomain = labels.at(-1);

  if (!topLevelDomain) {
    return false;
  }

  return (
    WEBSITE_ALPHA_TLD_PATTERN.test(topLevelDomain) ||
    WEBSITE_PUNYCODE_TLD_PATTERN.test(topLevelDomain)
  );
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
    const protocol = url.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return undefined;
    }

    if (!isPlausiblePublicWebsiteHostname(url.hostname)) {
      return undefined;
    }

    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

    return `${protocol}//${url.host.toLowerCase()}${pathname}`;
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
  values:
    Partial<
      Record<
        | keyof Omit<LeadIntakeInput, "recentReviews">
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
        | "latestReviewSnippet"
        | "latestReviewRating"
        | "latestReviewAuthor"
        | "latestReviewDate"
        | "latestReviewResponseStatus"
        | "primaryContactName"
        | "contactTitle"
        | "contactEmail"
        | "notes",
        string | number | undefined
      >
    > & {
      recentReviews?: Array<
        Partial<
          Record<
            keyof LeadIntakeRecentReviewInput,
            string | number | undefined
          >
        >
      >;
    },
  sourceKind: LeadIntakeInput["sourceKind"],
): LeadIntakeInput {
  const normalizedRecentReviews =
    normalizeLeadIntakeRecentReviews(values.recentReviews) ??
    (() => {
      const legacyReview = buildLegacyRecentReviewInput(values);

      return legacyReview ? [legacyReview] : undefined;
    })();
  const primaryReview = normalizedRecentReviews?.[0];

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
    latestReviewSnippet: primaryReview?.snippet,
    latestReviewRating: primaryReview?.rating,
    latestReviewAuthor: primaryReview?.author,
    latestReviewDate: primaryReview?.publishedAt,
    latestReviewResponseStatus: primaryReview?.responseStatus,
    recentReviews: normalizedRecentReviews,
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
  const recentReviewErrors: string[] = [];

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

  const recentReviews = getLeadIntakeRecentReviews(input);

  recentReviews.forEach((review, index) => {
    const slotLabel = `Review ${index + 1}`;
    const hasMetadataWithoutSnippet = !review.snippet && Boolean(
      review.rating != null ||
        review.author ||
        review.publishedAt ||
        review.responseStatus,
    );

    if (hasMetadataWithoutSnippet) {
      recentReviewErrors.push(
        `${slotLabel} needs a snippet before the review metadata can be imported.`,
      );
    }

    if (review.rating != null) {
      if (Number.isNaN(review.rating)) {
        recentReviewErrors.push(`${slotLabel} rating must be a number.`);
      } else if (review.rating < 0 || review.rating > 5) {
        recentReviewErrors.push(`${slotLabel} rating must be between 0 and 5.`);
      }
    }

    if (review.publishedAt) {
      const parsed = new Date(review.publishedAt);

      if (Number.isNaN(parsed.getTime())) {
        recentReviewErrors.push(`${slotLabel} date must be a valid date.`);
      }
    }
  });

  if (recentReviewErrors.length > 0) {
    fieldErrors.recentReviews = recentReviewErrors;
  }

  return fieldErrors;
}

export function getLeadIntakeIssueMessages(
  fieldErrors: LeadIntakeFieldErrors,
) {
  return Object.values(fieldErrors).flatMap((value) => {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  });
}

export function normalizeCompanyNameForComparison(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
