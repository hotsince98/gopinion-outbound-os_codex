import { scanCompanyWebsite } from "@/lib/data/enrichment/web";
import type {
  WebsiteEnrichmentProviderAdapter,
  WebsiteEnrichmentScanParams,
} from "@/lib/data/enrichment/providers/types";

export const basicWebsiteEnrichmentProvider: WebsiteEnrichmentProviderAdapter = {
  provider: "basic",
  async scanWebsite(params: WebsiteEnrichmentScanParams) {
    return scanCompanyWebsite(params.website, {
      preferredPageUrls: params.preferredPageUrls,
    });
  },
};
