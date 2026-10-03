import type { LegalDocumentSection } from "@/components/legal/legalDocument";

export const communityGuidelinesSections: readonly LegalDocumentSection[] = [
  { id: "respect", heading: "Be respectful", paragraphs: ["Treat other people the way you would in person. Harassment, hate and threats are not allowed."] },
  { id: "honest", heading: "Be honest", paragraphs: ["Do not impersonate others, mislead buyers or fake reviews and engagement."] },
  { id: "safe", heading: "Keep it safe", paragraphs: ["No illegal goods, counterfeit items or content that puts people at risk.", "[Team to replace: full prohibited items list and enforcement ladder.]"] },
];

export const sellerTermsSections: readonly LegalDocumentSection[] = [
  { id: "eligibility", heading: "Who can sell", paragraphs: ["You can sell if you pass verification for your account type and follow these terms and the Terms of service."] },
  { id: "listings", heading: "Listings and fulfilment", paragraphs: ["List accurately, ship on time and keep buyers updated. Payment is held in escrow until delivery is confirmed."] },
  { id: "fees", heading: "Fees and payouts", paragraphs: ["Fees and payout timing are shown in your seller dashboard. [Team to replace: final fee schedule and tax wording.]"] },
];

export const creatorTermsSections: readonly LegalDocumentSection[] = [
  { id: "program", heading: "The Creator Program", paragraphs: ["Creators who meet the eligibility thresholds can earn from subscriptions, gifts and ad revenue share."] },
  { id: "content", heading: "Your content", paragraphs: ["You keep ownership of what you post and give Zudomart the licence needed to show it in the app."] },
  { id: "earnings", heading: "Earnings", paragraphs: ["Earnings follow the revenue rules shown in your creator dashboard. [Team to replace: revenue share percentages and payout terms.]"] },
];

export const adsPolicySections: readonly LegalDocumentSection[] = [
  { id: "allowed", heading: "What ads can promote", paragraphs: ["Ads must be truthful, lawful and match the page they link to."] },
  { id: "restricted", heading: "Restricted and prohibited ads", paragraphs: ["Some categories need approval and some are never allowed. [Team to replace: policy category list.]"] },
  { id: "review", heading: "Review and enforcement", paragraphs: ["Every ad is reviewed before it runs and can be paused if it breaks this policy."] },
];

export const refundEscrowPolicySections: readonly LegalDocumentSection[] = [
  { id: "escrow", heading: "How escrow works", paragraphs: ["When you pay, Zudomart holds the money. The seller is paid after you confirm delivery or the protection window ends."] },
  { id: "refunds", heading: "When you get a refund", paragraphs: ["If an item does not arrive or is not as described, open a dispute before the window closes and we review it."] },
  { id: "timelines", heading: "Timelines", paragraphs: ["[Team to replace: protection window length, dispute deadlines and refund timelines.]"] },
];
