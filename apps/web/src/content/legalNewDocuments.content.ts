import type { LegalDocumentSection } from "@/components/legal/legalDocument";

export const communityGuidelinesSections: readonly LegalDocumentSection[] = [
  { id: "respect", heading: "Be respectful", paragraphs: ["Treat other people the way you would in person. Harassment, hate and threats are not allowed."] },
  { id: "honest", heading: "Be honest", paragraphs: ["Do not impersonate others, mislead buyers or fake reviews and engagement."] },
  { id: "safe", heading: "Keep it safe", paragraphs: ["No illegal goods, counterfeit items or content that puts people at risk.", "[Team to replace: full prohibited items list and enforcement ladder.]"] },
];

export const sellerTermsSections: readonly LegalDocumentSection[] = [
  { id: "eligibility", heading: "Who can sell", paragraphs: ["In Nigeria, you can open a store and sell through escrow up to a sales limit before you are verified, but you cannot withdraw until you are verified.", "Outside Nigeria, you must verify your identity and a payout account in your own name before you can list or sell anything. Accounts that try to get around this are suspended."] },
  { id: "listings", heading: "Listings and fulfilment", paragraphs: ["List accurately, ship on time and keep buyers updated. In Nigeria, the buyer's payment stays locked in escrow until delivery is confirmed. Outside Nigeria, you are paid when the payment settles, and you are fully responsible for refunds you owe buyers."] },
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
  { id: "escrow", heading: "How escrow works (Nigeria)", paragraphs: ["Zudomart never holds your money. When you pay in Nigeria, the money stays locked in your own wallet, which our licensed payment partner holds in your name. The seller is paid after you confirm delivery or the protection window ends."] },
  { id: "refunds", heading: "When you get a refund (Nigeria)", paragraphs: ["If an item does not arrive or is not as described, open a dispute before the window closes and we review it. If we refund you, the locked money is released back to your wallet."] },
  { id: "outside-nigeria", heading: "Outside Nigeria: no escrow, at your own risk", paragraphs: ["Escrow and buyer protection are not available outside Nigeria. You pay the seller directly through our payment partner, and Zudomart does not hold or control that money.", "If something goes wrong we can review your report, ask the seller to refund you, warn, restrict, suspend, freeze or ban the seller, report them to our payment partner and the authorities, and escalate your case to our payment partner for help. We cannot reverse payments or guarantee a refund. If our partner, your bank or your card issuer cannot recover the money, there may be nothing more we can do."] },
  { id: "timelines", heading: "Timelines", paragraphs: ["[Team to replace: protection window length, dispute deadlines and refund timelines.]"] },
];
