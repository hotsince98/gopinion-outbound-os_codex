import type { Company } from "@/lib/domain";

export const websiteDiscoveryProviders = ["open_web"] as const;
export type WebsiteDiscoveryProvider = (typeof websiteDiscoveryProviders)[number];
export const websiteDiscoveryCandidateSourceTypes = [
  "search_result",
  "direct_domain_inference",
  "operator_confirmed",
  "imported",
  "discovered_reviewed",
] as const;
export type WebsiteDiscoveryCandidateSourceType =
  (typeof websiteDiscoveryCandidateSourceTypes)[number];
export const websiteDiscoveryCandidateDecisions = [
  "accepted",
  "rejected",
  "needs_review",
] as const;
export type WebsiteDiscoveryCandidateDecision =
  (typeof websiteDiscoveryCandidateDecisions)[number];
export const websiteDiscoveryCandidateVerificationStages = [
  "not_run",
  "homepage",
  "lightweight_crawl",
] as const;
export type WebsiteDiscoveryCandidateVerificationStage =
  (typeof websiteDiscoveryCandidateVerificationStages)[number];

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
  sourceType: WebsiteDiscoveryCandidateSourceType;
  sourceDetail?: string;
  isGenericGuess: boolean;
}

export interface WebsiteDiscoveryCandidateDiagnostic {
  sourceType: WebsiteDiscoveryCandidateSourceType;
  sourceDetail?: string;
  isGenericGuess: boolean;
  rawCandidate: string;
  normalizedCandidate?: string;
  queryLabel: string;
  title?: string;
  score: number;
  strongSignalCount: number;
  verificationStage: WebsiteDiscoveryCandidateVerificationStage;
  verificationPageUrls: string[];
  verificationEvidence: string[];
  signalHits: string[];
  signalMisses: string[];
  decision: WebsiteDiscoveryCandidateDecision;
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
