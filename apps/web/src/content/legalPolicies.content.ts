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

const archivedDraftSections: readonly LegalDocumentSection[] = [
  { id: "archived", heading: "Earlier working draft", paragraphs: ["This earlier working draft was replaced before launch. It is kept so you can see how the document changed. It was never in effect."] },
];

const currentVersionLabel = "1.1 (draft)";
const currentEffectiveOn = "2026-12-01";

const firstFullDraftVersion: LegalPolicyVersion = { versionLabel: "1.0 (draft)", effectiveOn: "2026-11-01", isReviewedByLegal: false, changeSummary: "First full draft prepared for legal review.", sections: archivedDraftSections };
const workingOutlineVersion: LegalPolicyVersion = { versionLabel: "0.9 (draft)", effectiveOn: "2026-09-15", isReviewedByLegal: false, changeSummary: "Earlier working outline.", sections: archivedDraftSections };

function buildPolicy(slug: LegalPolicySlug, title: string, summary: string, sections: readonly LegalDocumentSection[], changeSummary: string, earlierVersions: readonly LegalPolicyVersion[]): LegalPolicy {
  return {
    slug, title, summary, publicPath: `/${slug}`,
    currentVersion: { versionLabel: currentVersionLabel, effectiveOn: currentEffectiveOn, isReviewedByLegal: false, changeSummary, sections },
    previousVersions: earlierVersions,
  };
}

const redraftedForNigerianLaw = "Rewritten against Nigerian law (NDPA 2023 and GAID 2025, FCCPA 2018, Copyright Act 2022, ARCON Act 2022, Arbitration and Mediation Act 2023) and the rules of our other launch countries. Reflects the move to Flutterwave, wallets held in your name, escrow in Nigeria only and verification levels.";

export const legalPolicies: readonly LegalPolicy[] = [
  buildPolicy("terms", "Terms of service", "The rules for buying, selling and posting on Zudomart.", termsOfServiceSections, `${redraftedForNigerianLaw} Adds age rules, Nigerian governing law with arbitration in Lagos, consumer rights, digital purchases and liability limits.`, [firstFullDraftVersion, workingOutlineVersion]),
  buildPolicy("privacy", "Privacy policy", "What personal data Zudomart collects, why, and the choices you have.", privacyPolicySections, `${redraftedForNigerianLaw} Adds lawful bases per purpose, named providers, transfer bases, a retention schedule, biometrics, and annexes for Ghana, Kenya, South Africa, the UK, the EU and the US.`, [firstFullDraftVersion, workingOutlineVersion]),
  buildPolicy("cookies", "Cookie policy", "Which cookies Zudomart uses, why, and how you stay in control.", cookiePolicySections, "Lists the cookies and storage we use today and explains app storage and consent records.", [firstFullDraftVersion]),
  buildPolicy("community-guidelines", "Community guidelines", "How we expect everyone to behave on Zudomart.", communityGuidelinesSections, "Full prohibited and restricted items lists and the enforcement ladder.", [firstFullDraftVersion]),
  buildPolicy("seller-terms", "Seller terms", "The extra terms that apply when you sell on Zudomart.", sellerTermsSections, "Full seller terms: eligibility and verification, escrow and payouts, fees and plans, returns duties and tax.", [firstFullDraftVersion]),
  buildPolicy("creator-terms", "Creator Program terms", "The terms for earning as a Zudomart creator.", creatorTermsSections, "Full creator terms: eligibility, gifts, subscriptions, ads revenue share, in-app purchases and payouts.", [firstFullDraftVersion]),
  buildPolicy("ads-policy", "Ads policy", "What can and cannot be advertised on Zudomart.", adsPolicySections, "Adds ARCON rules, verified-only advertising, Boosted and Sponsored labels, and the category lists.", [firstFullDraftVersion]),
  buildPolicy("refund-escrow-policy", "Refund and escrow policy", "How payments are held, released and refunded.", refundEscrowPolicySections, "Adds the full Nigeria escrow flow, refund methods, outside-Nigeria rules and timelines.", [firstFullDraftVersion]),
  buildPolicy("copyright-policy", "Copyright and IP policy", "How to report infringement and counterfeits, and how we handle repeat infringers.", copyrightPolicySections, "New: notice-and-takedown under Part VII of the Copyright Act 2022.", []),
  buildPolicy("data-rights", "Data rights requests", "How to access, correct, delete or move your personal data.", dataRightsRequestsSections, "New: how we handle data subject rights requests and how long we take.", []),
];

export function findLegalPolicyOrThrow(slug: LegalPolicySlug): LegalPolicy {
  const policy = legalPolicies.find((candidate) => candidate.slug === slug);
  if (!policy) throw new Error(`Unknown legal policy ${slug}`);
  return policy;
}
