export type PolicyDocumentKey = "terms" | "privacy" | "cookies" | "community-guidelines" | "seller-terms" | "creator-terms" | "ads-policy" | "refund-escrow-policy" | "copyright-policy" | "data-rights";

export interface PolicyVersionSummary {
  readonly policyVersionId: string;
  readonly documentKey: PolicyDocumentKey;
  readonly title: string;
  readonly versionLabel: string;
  readonly summary: string;
  readonly whatChanged?: readonly string[];
  readonly publishedAt: string;
  readonly effectiveAt: string;
  readonly isMaterialChange: boolean;
  readonly documentUrl: string;
}

export interface CurrentPolicyVersions {
  readonly items: readonly PolicyVersionSummary[];
}

export interface PolicyAcceptances {
  readonly acceptedPolicyVersionIds: readonly string[];
}
