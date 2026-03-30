import assert from "node:assert/strict";
import {
  areWorkspaceViewQueriesEqual,
  normalizeWorkspaceViewQuery,
} from "@/lib/data/workspace-views/browser";
import { getLeadWorkspaceViewPresets } from "@/lib/data/workspace-views/leads";

async function main() {
  const normalized = normalizeWorkspaceViewQuery({
    imported: "today",
    companyId: "company_test",
    sort: "review_priority",
    review: "urgent",
  });

  assert.deepEqual(normalized, {
    imported: "today",
    review: "urgent",
    sort: "review_priority",
  });

  assert(
    areWorkspaceViewQueriesEqual(
      { review: "urgent", sort: "review_priority", companyId: "company_a" },
      { sort: "review_priority", review: "urgent", companyId: "company_b" },
    ),
    "saved views compare on reusable filter state rather than transient selected company",
  );

  const presets = getLeadWorkspaceViewPresets();
  const reviewPreset = presets.find((preset) => preset.id === "leads_review_followup");

  assert(reviewPreset, "expected a built-in review follow-up view");
  assert.equal(reviewPreset.reviewLens.model, "recent_relevant_reviews");
  assert.equal(reviewPreset.query.review, "urgent");
}

void main();
