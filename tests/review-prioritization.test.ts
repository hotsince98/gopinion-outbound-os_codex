import assert from "node:assert/strict";
import { getDashboardView } from "@/lib/data/selectors/dashboard";
import { getLeadsWorkspaceView } from "@/lib/data/selectors/leads";
import { getLatestReviewSignal } from "@/lib/data/selectors/shared";
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

  assert.equal(harborSignal.filterState, "urgent");
  assert.equal(libertySignal.filterState, "urgent");
  assert.match(harborSignal.metaLabel, /No response yet/i);

  const dashboard = await getDashboardView();

  assert(
    dashboard.reviewWatchlist.some(
      (item) => item.companyId === "company_harbor_view_autos",
    ),
    "dashboard watchlist surfaces imported latest-review context",
  );

  const leads = await getLeadsWorkspaceView({ sort: "review_priority" });

  assert(
    leads.rows.some((row) => row.latestReviewBadge.label === "Review follow-up"),
    "lead workspace surfaces urgent latest-review signals",
  );
}

void main();
