import type { LegalDocumentSection } from "@/components/legal/legalDocument";

import { cookiePolicySections } from "./cookiePolicy.content";
import { adsPolicySections, communityGuidelinesSections, copyrightPolicySections, creatorTermsSections, dataRightsRequestsSections, refundEscrowPolicySections, sellerTermsSections } from "./legalNewDocuments.content";
import { privacyPolicySections } from "./privacyPolicy.content";
import { termsOfServiceSections } from "./termsOfService.content";

export type LegalPolicySlug = "terms" | "privacy" | "cookies" | "community-guidelines" | "seller-terms" | "creator-terms" | "ads-policy" | "refund-escrow-policy" | "copyright-policy" | "data-rights";

export interface LegalPolicyVersion {
  readonly versionLabel: string;
  readonly effectiveOn: string;
  readonly isReviewedByLegal: boolean;
  readonly changeSummary: string;
  readonly sections: readonly LegalDocumentSection[];
}

export interface LegalPolicy {
  readonly slug: LegalPolicySlug;
  readonly title: string;
  readonly summary: string;
  readonly publicPath: string;
  readonly currentVersion: LegalPolicyVersion;
  readonly previousVersions: readonly LegalPolicyVersion[];
}

const currentVersionLabel = "1.0 (draft)";
const currentEffectiveOn = "2026-12-01";
const firstVersionSummary = "First version, not yet in effect. Written under Nigerian law (NDPA 2023 and GAID 2025, FCCPA 2018, Copyright Act 2022, ARCON Act 2022, Arbitration and Mediation Act 2023), checked against how Nantty works today and against the published terms of large social and streaming platforms. [Team to confirm the effective date with counsel.]";

function buildPolicy(slug: LegalPolicySlug, title: string, summary: string, sections: readonly LegalDocumentSection[]): LegalPolicy {
  return {
    slug, title, summary, publicPath: `/${slug}`,
    currentVersion: { versionLabel: currentVersionLabel, effectiveOn: currentEffectiveOn, isReviewedByLegal: false, changeSummary: firstVersionSummary, sections },
    previousVersions: [],
  };
}

export const legalPolicies: readonly LegalPolicy[] = [
  buildPolicy("terms", "Terms of service", "The rules for buying, selling, posting, streaming and earning on Nantty.", termsOfServiceSections),
  buildPolicy("privacy", "Privacy policy", "What personal data Nantty collects, why, and the choices you have.", privacyPolicySections),
  buildPolicy("cookies", "Cookie policy", "Which cookies Nantty uses, why, and how you stay in control.", cookiePolicySections),
  buildPolicy("community-guidelines", "Community guidelines", "How we expect everyone to behave on Nantty.", communityGuidelinesSections),
  buildPolicy("seller-terms", "Seller terms", "The extra terms that apply when you sell on Nantty.", sellerTermsSections),
  buildPolicy("creator-terms", "Creator Program terms", "The terms for earning as a Nantty creator.", creatorTermsSections),
  buildPolicy("ads-policy", "Ads policy", "What can be advertised on Nantty, and how ad balance and ad credit work.", adsPolicySections),
  buildPolicy("refund-escrow-policy", "Refund and escrow policy", "How payments are held, released and refunded.", refundEscrowPolicySections),
  buildPolicy("copyright-policy", "Copyright and IP policy", "How to report infringement and counterfeits, and how we handle repeat infringers.", copyrightPolicySections),
  buildPolicy("data-rights", "Data rights requests", "How to access, correct, delete or move your personal data.", dataRightsRequestsSections),
];

export function findLegalPolicyOrThrow(slug: LegalPolicySlug): LegalPolicy {
  const policy = legalPolicies.find((candidate) => candidate.slug === slug);
  if (!policy) throw new Error(`Unknown legal policy ${slug}`);
  return policy;
}
