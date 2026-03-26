import { basicWebsiteEnrichmentProvider } from "@/lib/data/enrichment/providers/basic";
import { scraplingWebsiteEnrichmentProvider } from "@/lib/data/enrichment/providers/scrapling";
import type {
  EnrichmentProvider,
  WebsiteEnrichmentProviderAdapter,
  WebsiteEnrichmentScanParams,
} from "@/lib/data/enrichment/providers/types";

export { enrichmentProviders } from "@/lib/data/enrichment/providers/types";
export type {
  EnrichmentProvider,
  WebsiteEnrichmentProviderAdapter,
  WebsiteEnrichmentScanParams,
} from "@/lib/data/enrichment/providers/types";

function parseEnrichmentProvider(value: string | undefined): EnrichmentProvider {
  return value?.trim().toLowerCase() === "scrapling" ? "scrapling" : "basic";
}

export function getConfiguredEnrichmentProvider(): EnrichmentProvider {
  return parseEnrichmentProvider(process.env.ENRICHMENT_PROVIDER);
}

export function createWebsiteEnrichmentProvider(
  provider: EnrichmentProvider = getConfiguredEnrichmentProvider(),
): WebsiteEnrichmentProviderAdapter {
  switch (provider) {
    case "scrapling":
      return scraplingWebsiteEnrichmentProvider;
    case "basic":
    default:
      return basicWebsiteEnrichmentProvider;
  }
}

export async function scanCompanyWebsiteWithProvider(
  params: WebsiteEnrichmentScanParams,
) {
  return createWebsiteEnrichmentProvider().scanWebsite(params);
}
