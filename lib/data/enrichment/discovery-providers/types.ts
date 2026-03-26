import type { Company } from "@/lib/domain";

export const websiteDiscoveryProviders = ["open_web"] as const;
export type WebsiteDiscoveryProvider = (typeof websiteDiscoveryProviders)[number];

export interface WebsiteDiscoverySearchQuery {
  label: string;
  value: string;
}

export interface WebsiteDiscoveryCandidate {
  url: string;
  title: string;
  snippet: string;
  queryLabel: string;
}

export interface WebsiteDiscoverySearchRun {
  provider: WebsiteDiscoveryProvider;
  providerLabel: string;
  queries: WebsiteDiscoverySearchQuery[];
  candidates: WebsiteDiscoveryCandidate[];
  errors: string[];
}

export interface WebsiteDiscoveryProviderAdapter {
  provider: WebsiteDiscoveryProvider;
  label: string;
  search(company: Company): Promise<WebsiteDiscoverySearchRun>;
}
