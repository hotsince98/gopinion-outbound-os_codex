import type { Company } from "@/lib/domain";

export const websiteDiscoveryProviders = ["open_web"] as const;
export type WebsiteDiscoveryProvider = (typeof websiteDiscoveryProviders)[number];

export interface WebsiteDiscoverySearchQuery {
  label: string;
  value: string;
}

export interface WebsiteDiscoveryCandidate {
  rawUrl: string;
  normalizedUrl: string;
  url: string;
  title: string;
  snippet: string;
  queryLabel: string;
  acceptanceReason: string;
}

export interface WebsiteDiscoveryCandidateDiagnostic {
  rawCandidate: string;
  normalizedCandidate?: string;
  queryLabel: string;
  title?: string;
  decision: "accepted" | "rejected";
  reason: string;
}

export interface WebsiteDiscoveryDiscardedCandidate {
  rawUrl: string;
  normalizedUrl?: string;
  queryLabel: string;
  reason: string;
  title?: string;
}

export interface WebsiteDiscoverySearchRun {
  provider: WebsiteDiscoveryProvider;
  providerLabel: string;
  queries: WebsiteDiscoverySearchQuery[];
  candidates: WebsiteDiscoveryCandidate[];
  candidateDiagnostics: WebsiteDiscoveryCandidateDiagnostic[];
  discardedCandidates: WebsiteDiscoveryDiscardedCandidate[];
  errors: string[];
}

export interface WebsiteDiscoveryProviderAdapter {
  provider: WebsiteDiscoveryProvider;
  label: string;
  search(company: Company): Promise<WebsiteDiscoverySearchRun>;
}
