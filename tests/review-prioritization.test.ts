import assert from "node:assert/strict";
import { getDashboardView } from "@/lib/data/selectors/dashboard";
import { getLeadsWorkspaceView } from "@/lib/data/selectors/leads";
import {
  getLatestReviewSignal,
  getRecentReviewContext,
} from "@/lib/data/selectors/shared";
import { mockCompanies } from "@/lib/data/mock/store";

async function main() {
  const harbor = mockCompanies.find(
    (company) => company.id === "company_harbor_view_autos",
  );
  const liberty = mockCompanies.find(
    (company) => company.id === "company_liberty_auto_outlet",
  );

  assert(harbor, "expected Harbor View Autos in mock data");
  assert(liberty, "expected Liberty Auto Outlet in mock data");

  const harborSignal = getLatestReviewSignal(harbor);
  const libertySignal = getLatestReviewSignal(liberty);
  const harborReviewContext = getRecentReviewContext(harbor);
  const libertyReviewContext = getRecentReviewContext(liberty);

  assert.equal(harborSignal.filterState, "urgent");
  assert.equal(libertySignal.filterState, "urgent");
  assert.equal(harborReviewContext.reviews.length, 3);
  assert(harborReviewContext.urgentCount >= 2);
  assert.equal(harborReviewContext.badge.label, "Repeated review pressure");
  assert.match(harborSignal.metaLabel, /3 reviews/i);
  assert.equal(libertyReviewContext.reviews.length, 3);

  const dashboard = await getDashboardView();
  const harborWatchItem = dashboard.reviewWatchlist.find(
    (item) => item.companyId === "company_harbor_view_autos",
  );

  assert(
    harborWatchItem,
    "dashboard watchlist surfaces imported latest-review context",
  );
  assert.equal(harborWatchItem.recentReviews.length, 3);

  const leads = await getLeadsWorkspaceView({ sort: "review_priority" });
  const harborLead = leads.rows.find(
    (row) => row.companyId === "company_harbor_view_autos",
  );

  assert(
    leads.rows.some((row) => row.latestReviewBadge.tone === "danger"),
    "lead workspace surfaces urgent recent-review signals",
  );
  assert(harborLead, "expected Harbor View Autos in leads workspace");
  assert.equal(harborLead.recentReviews.length, 3);
  assert.match(harborLead.latestReviewMetaLabel, /3 reviews/i);
}

void main();
