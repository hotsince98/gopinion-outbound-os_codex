import { scanCompanyWebsite } from "@/lib/data/enrichment/web";
import type {
  WebsiteEnrichmentProviderAdapter,
  WebsiteEnrichmentScanParams,
} from "@/lib/data/enrichment/providers/types";

export const basicWebsiteEnrichmentProvider: WebsiteEnrichmentProviderAdapter = {
  provider: "basic",
  async scanWebsite(params: WebsiteEnrichmentScanParams) {
    const result = await scanCompanyWebsite(params.website, {
      preferredPageUrls: params.preferredPageUrls,
    });

    return {
      ...result,
      requestedProvider: "basic",
      actualProvider: "basic",
      fallbackUsed: false,
      fallbackReason: undefined,
      crawlAttempted: Boolean(params.website),
      providerEvidence: result.evidenceSummary,
    };
  },
};
