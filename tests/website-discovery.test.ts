import assert from "node:assert/strict";
import type { Company } from "@/lib/domain";
import { discoverCompanyWebsite } from "@/lib/data/enrichment/discovery";
import { resolveWebsiteEnrichmentInput } from "@/lib/data/enrichment/service";
import {
  extractSearchCandidatesFromHtml,
  openWebWebsiteDiscoveryProvider,
} from "@/lib/data/enrichment/discovery-providers/open-web";

const NOW = "2026-03-27T12:00:00.000Z";

function buildCompany(
  overrides: Omit<Partial<Company>, "location" | "presence" | "scoring" | "source"> & {
    location?: Partial<Company["location"]>;
    presence?: Partial<Company["presence"]>;
    scoring?: Partial<Company["scoring"]>;
    source?: Partial<Company["source"]>;
  } = {},
): Company {
  const base: Company = {
    id: "company_parkway_auto_trade",
    createdAt: NOW,
    updatedAt: NOW,
    name: "Parkway Auto Trade",
    industryKey: "independent_used_car_dealer",
    subindustry: "Independent used car dealer",
    icpProfileId: "icp_independent_used_car_dealer",
    status: "new",
    priorityTier: "tier_1",
    isIndependent: true,
    location: {
      streetAddress: "123 Weston Rd",
      city: "Toronto",
      state: "Ontario",
      postalCode: "M6N 3P1",
      country: "CA",
    },
    presence: {
      hasWebsite: false,
      primaryPhone: "(416) 555-0123",
      hasClaimedGoogleBusinessProfile: true,
      googleBusinessProfileUrl:
        "https://www.google.com/maps/place/Parkway+Auto+Trade+Toronto",
      googleRating: 3.8,
      reviewCount: 42,
      reviewResponseBand: "low",
    },
    buyingStage: "pain_aware",
    painSignals: [],
    disqualifierSignals: [],
    recommendedOfferIds: [],
    activeCampaignIds: [],
    appointmentIds: [],
    scoring: {
      fitScore: 80,
      offerFitScore: 76,
      outreachReadinessScore: 44,
      bucket: "high",
      reasons: [],
    },
    source: {
      kind: "mock",
      provider: "test-suite",
      label: "Test suite",
      observedAt: NOW,
    },
  };

  return {
    ...base,
    ...overrides,
    location: {
      ...base.location,
      ...(overrides.location ?? {}),
    },
    presence: {
      ...base.presence,
      ...(overrides.presence ?? {}),
    },
    scoring: {
      ...base.scoring,
      ...(overrides.scoring ?? {}),
    },
    source: {
      ...base.source,
      ...(overrides.source ?? {}),
    },
  };
}

function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function getUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

async function withMockFetch(
  handler: (url: string) => Promise<Response> | Response,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => handler(getUrl(input))) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  const wrappedResultsHtml = `
    <div class="result">
      <a class="result__a" href="/html/?q=Parkway+Auto+Trade">DuckDuckGo internal result</a>
      <span class="result__url">duckduckgo.com/html/</span>
      <div class="result__snippet">Internal search page</div>
    </div>
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.parkwayauto.com%2Finventory">Parkway Auto Trade | Used Cars in Toronto</a>
      <span class="result__url">www.parkwayauto.com &rsaquo; inventory</span>
      <div class="result__snippet">Parkway Auto Trade serving Toronto, Ontario. Call 416-555-0123 today.</div>
    </div>
    <div class="result">
      <a class="result__a" href="https://duckduckgo.com/?q=parkway+auto+trade">DuckDuckGo result page</a>
      <div class="result__snippet">Another internal page</div>
    </div>
  `;

  {
    const parsed = extractSearchCandidatesFromHtml(
      wrappedResultsHtml,
      "business name + location",
    );

    assert.equal(parsed.candidates[0]?.url, "https://www.parkwayauto.com");
    assert(
      parsed.candidateDiagnostics.some(
        (candidate) =>
          candidate.rawCandidate === "/html/?q=Parkway+Auto+Trade" &&
          candidate.decision === "rejected" &&
          /internal wrapper|internal path/i.test(candidate.reason),
      ),
      "rejects DuckDuckGo internal /html/ links",
    );
    assert(
      parsed.candidateDiagnostics.some(
        (candidate) =>
          candidate.rawCandidate.includes("uddg=") &&
          candidate.decision === "accepted" &&
          candidate.normalizedCandidate === "https://www.parkwayauto.com",
      ),
      "unwraps DuckDuckGo redirect links to the real website",
    );
    assert(
      parsed.candidateDiagnostics.some(
        (candidate) =>
          candidate.rawCandidate === "https://duckduckgo.com/?q=parkway+auto+trade" &&
          candidate.decision === "rejected" &&
          /internal wrapper|blocked/i.test(candidate.reason),
      ),
      "rejects search-engine result pages as business-site candidates",
    );
  }

  {
    const fallbackHtml = `
      <div class="result">
        <a class="result__a" href="/html/?q=parkway+auto+trade">Parkway Auto Trade</a>
        <span class="result__url">www.parkwayauto.com &rsaquo; team</span>
        <div class="result__snippet">Toronto dealership team page.</div>
      </div>
    `;
    const parsed = extractSearchCandidatesFromHtml(
      fallbackHtml,
      "business name + maps profile hints",
    );

    assert.equal(parsed.candidates[0]?.url, "https://www.parkwayauto.com");
    assert(
      parsed.candidateDiagnostics.some(
        (candidate) =>
          candidate.rawCandidate === "/html/?q=parkway+auto+trade" &&
          candidate.decision === "rejected",
      ),
      "keeps a rejected diagnostic for the internal wrapper candidate",
    );
    assert(
      parsed.candidateDiagnostics.some(
        (candidate) =>
          candidate.rawCandidate.includes("www.parkwayauto.com") &&
          candidate.decision === "accepted" &&
          candidate.normalizedCandidate === "https://www.parkwayauto.com",
      ),
      "rescues the destination site from the visible result URL when href is internal",
    );
  }

  {
    const requestedUrls: string[] = [];
    await withMockFetch(
      (url) => {
        requestedUrls.push(url);
        return htmlResponse("<html><body>No results</body></html>");
      },
      async () => {
        const searchRun = await openWebWebsiteDiscoveryProvider.search(buildCompany());

        assert(
          searchRun.queries.some(
            (query) => query.label === "business name + location + phone",
          ),
          "adds a phone-backed discovery query",
        );
        assert(
          searchRun.queries.some(
            (query) => query.label === "business name + maps profile hints + phone",
          ),
          "adds a maps-hints-plus-phone query",
        );
        assert(
          searchRun.queries.some(
            (query) => query.label === "business name + street + phone",
          ),
          "adds a street-plus-phone query",
        );
        assert.equal(
          requestedUrls.length,
          searchRun.queries.length,
          "executes one search request per generated query variant",
        );
      },
    );
  }

  {
    const weakSearchResultsHtml = `
      <div class="result">
        <a class="result__a" href="/html/?q=Parkway+Auto+Trade">DuckDuckGo internal result</a>
        <div class="result__snippet">Search result page only.</div>
      </div>
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/?q=parkway+auto+trade">DuckDuckGo result page</a>
        <div class="result__snippet">Another internal page.</div>
      </div>
    `;
    const homepageHtml = `
      <html>
        <head>
          <title>Parkway Auto Trade | Used Cars in Toronto</title>
        </head>
        <body>
          <h1>Parkway Auto Trade</h1>
          <p>123 Weston Rd, Toronto, Ontario</p>
          <p>Call us at (416) 555-0123</p>
          <a href="/team">Meet the team</a>
          <a href="/contact">Contact us</a>
        </body>
      </html>
    `;

    await withMockFetch(
      (url) => {
        if (url.startsWith("https://duckduckgo.com/html/")) {
          return htmlResponse(weakSearchResultsHtml);
        }

        if (url === "https://parkwayauto.com") {
          return htmlResponse(homepageHtml);
        }

        throw new Error(`Unexpected fetch URL in weak-search test: ${url}`);
      },
      async () => {
        const snapshot = await discoverCompanyWebsite(buildCompany(), NOW);

        assert.equal(snapshot.discoveredWebsite, "https://parkwayauto.com");
        assert.equal(snapshot.confirmationStatus, "auto_confirmed");
        assert(
          snapshot.candidateDiagnostics.some(
            (candidate) =>
              candidate.sourceType === "search_result" &&
              candidate.decision === "rejected",
          ),
          "keeps rejected weak search-result candidates distinguishable from inferred ones",
        );
        assert(
          snapshot.candidateDiagnostics.some(
            (candidate) =>
              candidate.sourceType === "direct_domain_inference" &&
              candidate.normalizedCandidate === "https://parkwayauto.com" &&
              candidate.decision === "accepted",
          ),
          "auto-confirms a strong inferred domain candidate when weak search results fail",
        );

        const enrichmentInput = resolveWebsiteEnrichmentInput({
          company: buildCompany(),
          websiteDiscovery: snapshot,
        });

        assert.deepEqual(
          enrichmentInput,
          {
            website: "https://parkwayauto.com",
            status: "confirmed_website",
            source: "discovery_confirmed",
          },
          "hands an auto-confirmed inferred domain into the enrichment flow",
        );
      },
    );
  }

  {
    const genericHomepageHtml = `
      <html>
        <head>
          <title>Parkway</title>
        </head>
        <body>
          <h1>Parkway</h1>
          <p>Call us at (416) 555-0123</p>
        </body>
      </html>
    `;

    await withMockFetch(
      (url) => {
        if (url.startsWith("https://duckduckgo.com/html/")) {
          return htmlResponse("<html><body>No results</body></html>");
        }

        if (url === "https://parkway.com") {
          return htmlResponse(genericHomepageHtml);
        }

        throw new Error(`Unexpected fetch URL in generic-domain test: ${url}`);
      },
      async () => {
        const snapshot = await discoverCompanyWebsite(
          buildCompany({
            name: "Parkway",
            presence: {
              googleBusinessProfileUrl:
                "https://www.google.com/maps/place/Parkway+Toronto",
            },
          }),
          NOW,
        );

        assert.equal(snapshot.confirmationStatus, "needs_review");
        assert.equal(snapshot.candidateWebsite, "https://parkway.com");
        assert(
          snapshot.candidateDiagnostics.some(
            (candidate) =>
              candidate.sourceType === "direct_domain_inference" &&
              candidate.normalizedCandidate === "https://parkway.com" &&
              candidate.decision === "needs_review" &&
              candidate.isGenericGuess,
          ),
          "generic inferred domains stay in review instead of auto-confirming without enough strong signals",
        );
      },
    );
  }

  {
    const homepageHtml = `
      <html>
        <head>
          <title>Parkway Auto Trade | Used Cars in Toronto</title>
        </head>
        <body>
          <h1>Parkway Auto Trade</h1>
          <p>123 Weston Rd, Toronto, Ontario</p>
          <p>Call us at (416) 555-0123</p>
          <a href="/team">Meet the team</a>
          <a href="/contact">Contact us</a>
        </body>
      </html>
    `;

    await withMockFetch(
      (url) => {
        if (url.startsWith("https://duckduckgo.com/html/")) {
          return htmlResponse(wrappedResultsHtml);
        }

        if (url === "https://www.parkwayauto.com") {
          return htmlResponse(homepageHtml);
        }

        throw new Error(`Unexpected fetch URL in test: ${url}`);
      },
      async () => {
        const snapshot = await discoverCompanyWebsite(buildCompany(), NOW);

        assert.equal(snapshot.discoveredWebsite, "https://www.parkwayauto.com");
        assert.equal(snapshot.confirmationStatus, "auto_confirmed");
        assert(
          snapshot.candidateDiagnostics.some(
            (candidate) =>
              candidate.sourceType === "search_result" &&
              candidate.rawCandidate.includes("uddg=") &&
              candidate.normalizedCandidate === "https://www.parkwayauto.com" &&
              candidate.decision === "accepted",
          ),
          "stores accepted candidate diagnostics on the discovery snapshot",
        );
        assert(
          snapshot.candidateDiagnostics.some(
            (candidate) =>
              candidate.rawCandidate === "/html/?q=Parkway+Auto+Trade" &&
              candidate.decision === "rejected",
          ),
          "stores rejected candidate diagnostics on the discovery snapshot",
        );

        const enrichmentInput = resolveWebsiteEnrichmentInput({
          company: buildCompany(),
          websiteDiscovery: snapshot,
        });

        assert.deepEqual(
          enrichmentInput,
          {
            website: "https://www.parkwayauto.com",
            status: "confirmed_website",
            source: "discovery_confirmed",
          },
          "hands an auto-confirmed search-result discovery website into the enrichment flow",
        );
      },
    );
  }

  console.log("website-discovery.test.ts: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
