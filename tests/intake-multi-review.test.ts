import assert from "node:assert/strict";
import { buildLeadCsvPreview, parseLeadCsvText } from "@/lib/data/intake/csv";
import { createLeadFromInput } from "@/lib/data/intake/service";
import {
  normalizeLeadIntakeInput,
  validateLeadIntakeInput,
} from "@/lib/data/intake/validation";

async function main() {
  const manualInput = normalizeLeadIntakeInput(
    {
      companyName: "Three Review Manual Test",
      city: "Toronto",
      state: "ON",
      country: "Canada",
      recentReviews: [
        {
          snippet: "Still waiting on a promised callback after delivery.",
          rating: "2.0",
          author: "Riley P.",
          publishedAt: "2026-03-29",
          responseStatus: "not_responded",
        },
        {
          snippet: "Inventory looked strong, but communication stayed slow.",
          rating: "3.0",
          author: "Morgan L.",
          publishedAt: "2026-03-26",
          responseStatus: "responded",
        },
        {
          snippet: "Follow-up issue took too long to resolve.",
          rating: "2.5",
          author: "Casey J.",
          publishedAt: "2026-03-21",
          responseStatus: "not_responded",
        },
      ],
    },
    "manual",
  );

  assert.equal(manualInput.recentReviews?.length, 3);
  assert.equal(manualInput.latestReviewSnippet, manualInput.recentReviews?.[0]?.snippet);

  const malformedInput = normalizeLeadIntakeInput(
    {
      companyName: "Malformed Review Test",
      city: "Austin",
      state: "TX",
      country: "US",
      recentReviews: [
        {
          rating: "2.0",
          publishedAt: "2026-03-29",
        },
      ],
    },
    "manual",
  );

  const malformedErrors = validateLeadIntakeInput(malformedInput);
  assert(malformedErrors.recentReviews?.[0]?.includes("needs a snippet"));

  const csvText = [
    [
      "company name",
      "city",
      "state",
      "country",
      "review 1 snippet",
      "review 1 rating",
      "review 1 author",
      "review 1 date",
      "review 1 response status",
      "review 2 snippet",
      "review 2 rating",
      "review 2 author",
      "review 2 date",
      "review 2 response status",
      "review 3 snippet",
      "review 3 rating",
      "review 3 author",
      "review 3 date",
      "review 3 response status",
    ].join(","),
    [
      "CSV Multi Review Motors",
      "Chicago",
      "IL",
      "US",
      "\"Still waiting on a title update\"",
      "1.0",
      "Pat C.",
      "2026-03-29",
      "not_responded",
      "\"The team was polite but follow-up lagged\"",
      "3.0",
      "Alex M.",
      "2026-03-26",
      "responded",
      "\"The paperwork issue eventually got fixed\"",
      "4.0",
      "Jordan R.",
      "2026-03-20",
      "responded",
    ].join(","),
    [
      "Broken Review Row",
      "Denver",
      "CO",
      "US",
      "",
      "",
      "",
      "",
      "",
      "",
      "2.0",
      "Taylor Q.",
      "2026-03-27",
      "not_responded",
      "",
      "",
      "",
      "",
      "",
    ].join(","),
  ].join("\n");

  const parsed = parseLeadCsvText(csvText);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]?.input.recentReviews?.length, 3);
  assert(parsed.rows[1]?.issues.some((issue) => issue.includes("needs a snippet")));

  const preview = buildLeadCsvPreview(parsed);
  assert.equal(preview.rows[0]?.reviewLabel, "3 recent reviews mapped");
  assert.equal(preview.rows[0]?.reviewSnippets.length, 2);

  const uniqueSuffix = Date.now().toString(36);
  const outcome = await createLeadFromInput(
    normalizeLeadIntakeInput(
      {
        companyName: `Multi Review Import ${uniqueSuffix}`,
        website: `https://multireview-${uniqueSuffix}.example`,
        city: "Miami",
        state: "FL",
        country: "US",
        googleRating: "3.4",
        reviewCount: "44",
        recentReviews: [
          {
            snippet: "Nobody has replied to the follow-up issue yet.",
            rating: "1.0",
            author: "Jamie W.",
            publishedAt: "2026-03-29",
            responseStatus: "not_responded",
          },
          {
            snippet: "The buying process was okay, but after-sale communication lagged.",
            rating: "3.0",
            author: "Taylor B.",
            publishedAt: "2026-03-25",
            responseStatus: "responded",
          },
          {
            snippet: "Paperwork questions took too long to resolve.",
            rating: "2.0",
            author: "Chris N.",
            publishedAt: "2026-03-22",
            responseStatus: "not_responded",
          },
        ],
      },
      "manual",
    ),
  );

  assert.equal(outcome.status, "success");
  assert.equal(outcome.result?.company.presence.latestReviews?.length, 3);
  assert.equal(outcome.result?.company.presence.reviewResponseBand, "low");
}

void main();
