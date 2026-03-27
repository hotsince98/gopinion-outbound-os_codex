import assert from "node:assert/strict";
import {
  assessContactPath,
  buildContactQualitySnapshot,
  rankContactsForPrimarySelection,
} from "@/lib/data/contacts/quality";
import { resetDataAccessCache } from "@/lib/data/access";
import { scanCompanyWebsite } from "@/lib/data/enrichment/web";
import { getLeadEnrichmentWorkspaceView } from "@/lib/data/selectors/lead-enrichment";
import type { Company, Contact } from "@/lib/domain";
import { mockCompanies, mockContacts } from "@/lib/data/mock/store";

const NOW = "2026-03-27T12:00:00.000Z";

function buildCompany(
  id: Company["id"],
  name: string,
  websiteUrl: string,
  overrides: Partial<Company> = {},
): Company {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    name,
    industryKey: "independent_used_car_dealer",
    subindustry: "Independent used car dealer",
    icpProfileId: "icp_independent_used_car_dealer",
    status: "enriched",
    priorityTier: "tier_1",
    isIndependent: true,
    location: {
      city: "Toronto",
      state: "Ontario",
      country: "CA",
    },
    presence: {
      hasWebsite: true,
      websiteUrl,
      primaryPhone: "(416) 555-0100",
      hasClaimedGoogleBusinessProfile: true,
      googleRating: 3.9,
      reviewCount: 37,
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
    enrichment: {
      lastEnrichedAt: NOW,
      confidenceLevel: "medium",
      confidenceScore: 68,
      contactPath: "named_contact",
      enrichmentSource: "public_website",
      sourceUrls: [websiteUrl],
      pagesChecked: [websiteUrl],
      foundEmails: [],
      foundPhones: [],
      foundNames: [],
      missingFields: [],
      noteHints: [],
      manualReviewRequired: true,
      linkedinVerificationNeeded: false,
      linkedinVerified: false,
      websiteDiscovery: {
        status: "discovered",
        confirmationStatus: "auto_confirmed",
        source: {
          kind: "mock",
          provider: "test-suite",
          label: "Discovery test",
          observedAt: NOW,
        },
        discoveredWebsite: websiteUrl,
        candidateUrls: [websiteUrl],
        confidenceScore: 82,
        confidenceLevel: "high",
        matchedSignals: ["Confirmed website on record"],
        extractedEvidence: [],
        debugNotes: [],
        candidateDiagnostics: [],
        supportingPageUrls: [],
        contactPageUrls: [],
        staffPageUrls: [],
      },
    },
    ...overrides,
  };
}

function buildContact(params: {
  id: Contact["id"];
  companyId: Contact["companyId"];
  email?: string;
  phone?: string;
  fullName?: string;
  title?: string;
  isPrimary?: boolean;
}) {
  const assessment = assessContactPath({
    email: params.email,
    phone: params.phone,
    fullName: params.fullName,
    title: params.title,
    companyHost: "parkwayautotrade.com",
    hasWebsiteEvidence: true,
    preferCurrentPrimary: params.isPrimary,
  });

  return {
    id: params.id,
    companyId: params.companyId,
    createdAt: NOW,
    updatedAt: NOW,
    fullName: params.fullName,
    title: params.title,
    role: "unknown",
    email: params.email,
    phone: params.phone,
    linkedinUrl: undefined,
    sourceKind: "observed",
    status: assessment.status,
    isPrimary: Boolean(params.isPrimary),
    outreachReady: assessment.campaignEligible,
    confidence: {
      score: assessment.confidenceScore,
      signals: assessment.selectionReasons,
    },
    quality: buildContactQualitySnapshot(assessment, NOW),
    notes: [],
    source: {
      kind: "provider",
      provider: "test-suite",
      label: "Website enrichment",
      observedAt: NOW,
      url: "https://www.parkwayautotrade.com/team",
    },
  } satisfies Contact;
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
  await withMockFetch(
    (url) => {
      if (url === "https://www.parkwayautotrade.com") {
        return htmlResponse(`
          <html>
            <body>
              <a href="/team">Meet the team</a>
              <a href="/contact">Contact</a>
            </body>
          </html>
        `);
      }

      if (url === "https://www.parkwayautotrade.com/team") {
        return htmlResponse(`
          <html>
            <body>
              <section>
                <h2>Jane Smith</h2>
                <p>General Manager</p>
                <p>jane@parkwayautotrade.com</p>
                <p>(416) 555-0199</p>
              </section>
            </body>
          </html>
        `);
      }

      return new Response("missing", { status: 404 });
    },
    async () => {
      const websiteScan = await scanCompanyWebsite("https://www.parkwayautotrade.com");
      const jane = websiteScan.namedContacts.find(
        (candidate) => candidate.fullName === "Jane Smith",
      );

      assert.equal(jane?.email, "jane@parkwayautotrade.com");
      assert.equal(jane?.phone, "(416) 555-0199");
      assert.equal(jane?.pageKind, "staff");
      assert(
        jane?.evidence.some((signal) => /direct email appeared near the contact/i.test(signal)),
        "captures proximity evidence for named contacts on staff pages",
      );
    },
  );

  {
    const ranked = rankContactsForPrimarySelection(
      [
        buildContact({
          id: "contact_named_gm",
          companyId: "company_parkway",
          fullName: "Jane Smith",
          title: "General Manager",
          email: "jane@parkwayautotrade.com",
        }),
        buildContact({
          id: "contact_inbox",
          companyId: "company_parkway",
          email: "info@parkwayautotrade.com",
        }),
      ],
      {
        companyHost: "parkwayautotrade.com",
        angleKey: "review_growth_opportunity",
      },
    );

    assert.equal(ranked[0]?.contact.fullName, "Jane Smith");
    assert(
      ranked[0]?.selectionReasons.some((reason) =>
        /named person has a direct same-domain inbox/i.test(reason),
      ),
      "promotes the named same-domain contact over the generic inbox",
    );
  }

  {
    const ranked = rankContactsForPrimarySelection(
      [
        buildContact({
          id: "contact_inbox",
          companyId: "company_parkway",
          email: "info@parkwayautotrade.com",
        }),
        buildContact({
          id: "contact_named_phone",
          companyId: "company_parkway",
          fullName: "Jane Smith",
          title: "General Manager",
          phone: "(416) 555-0199",
        }),
      ],
      {
        companyHost: "parkwayautotrade.com",
        angleKey: "review_growth_opportunity",
      },
    );

    assert.equal(ranked[0]?.contact.email, "info@parkwayautotrade.com");
    assert(
      ranked[0]?.selectionReasons.some((reason) =>
        /business inbox stayed primary/i.test(reason),
      ),
      "keeps the inbox primary when the named candidate is weaker",
    );
    assert(
      ranked[1]?.demotionReasons.some((reason) =>
        /no stronger same-domain direct inbox was verified/i.test(reason),
      ),
      "explains why the named fallback was not promoted",
    );
  }

  {
    const extraCompanies = [
      buildCompany(
        "company_group_one",
        "Parkway Downtown",
        "https://www.shareddealer.com",
      ),
      buildCompany(
        "company_group_two",
        "Parkway West",
        "https://www.shareddealer.com",
      ),
    ];
    const extraContacts = [
      buildContact({
        id: "contact_group_one",
        companyId: "company_group_one",
        fullName: "Alex Grant",
        title: "General Manager",
        email: "alex@shareddealer.com",
      }),
      buildContact({
        id: "contact_group_two",
        companyId: "company_group_two",
        fullName: "Alex Grant",
        title: "General Manager",
        email: "alex@shareddealer.com",
      }),
    ];

    mockCompanies.push(...extraCompanies);
    mockContacts.push(...extraContacts);
    resetDataAccessCache();

    try {
      const workspaceView = await getLeadEnrichmentWorkspaceView();
      const relatedRow = workspaceView.rows.find(
        (row) => row.companyId === "company_group_one",
      );

      assert(relatedRow, "expected the seeded company to appear in the enrichment queue");
      assert(
        relatedRow.relatedAccountSignals.some((signal) =>
          /website host pattern matches/i.test(signal),
        ),
        "surfaces shared host patterns in the queue view",
      );
      assert(
        relatedRow.relatedAccountSignals.some((signal) =>
          /contact email alex@shareddealer.com appears/i.test(signal),
        ),
        "surfaces shared contact email overlap in the queue view",
      );
    } finally {
      mockCompanies.splice(
        mockCompanies.findIndex((company) => company.id === "company_group_one"),
        2,
      );
      mockContacts.splice(
        mockContacts.findIndex((contact) => contact.id === "contact_group_one"),
        2,
      );
      resetDataAccessCache();
    }
  }

  console.log("contact-ranking tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
