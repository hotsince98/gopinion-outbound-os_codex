import { openWebWebsiteDiscoveryProvider } from "@/lib/data/enrichment/discovery-providers/open-web";
import type {
  WebsiteDiscoveryProvider,
  WebsiteDiscoveryProviderAdapter,
} from "@/lib/data/enrichment/discovery-providers/types";

export { websiteDiscoveryProviders } from "@/lib/data/enrichment/discovery-providers/types";
export type {
  WebsiteDiscoveryCandidate,
  WebsiteDiscoveryCandidateDiagnostic,
  WebsiteDiscoveryProvider,
  WebsiteDiscoveryProviderAdapter,
  WebsiteDiscoverySearchQuery,
  WebsiteDiscoverySearchRun,
} from "@/lib/data/enrichment/discovery-providers/types";

function parseWebsiteDiscoveryProvider(
  value: string | undefined,
): WebsiteDiscoveryProvider {
  switch (value?.trim().toLowerCase()) {
    case "open-web":
    case "duckduckgo":
    case "open_web":
    default:
      return "open_web";
  }
}

export function getConfiguredWebsiteDiscoveryProvider(): WebsiteDiscoveryProvider {
  return parseWebsiteDiscoveryProvider(process.env.WEBSITE_DISCOVERY_PROVIDER);
}

export function createWebsiteDiscoveryProvider(
  provider: WebsiteDiscoveryProvider = getConfiguredWebsiteDiscoveryProvider(),
): WebsiteDiscoveryProviderAdapter {
  switch (provider) {
    case "open_web":
    default:
      return openWebWebsiteDiscoveryProvider;
  }
}
