import type { WebsiteScanResult } from "@/lib/data/enrichment/web";

export const enrichmentProviders = ["basic", "scrapling"] as const;
export type EnrichmentProvider = (typeof enrichmentProviders)[number];

export interface WebsiteEnrichmentScanParams {
  website?: string;
  preferredPageUrls?: string[];
}

export interface WebsiteEnrichmentProviderAdapter {
  provider: EnrichmentProvider;
  scanWebsite(params: WebsiteEnrichmentScanParams): Promise<WebsiteScanResult>;
}
