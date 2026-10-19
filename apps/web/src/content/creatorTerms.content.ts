import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const creatorTermsSections: readonly LegalDocumentSection[] = [
  {
    id: "program",
    heading: "The Creator Program",
    paragraphs: [
      "These terms apply on top of the Terms of Service when your personal profile is approved for the Creator Program. Creator status is an upgrade to your personal profile, not a separate account. You take part as an independent creator, not as an employee or agent of Zudomart.",
      "Eligibility is based on criteria shown in Creator Studio, such as real followers, account age, policy record and risk checks. Some accounts are approved automatically, some are reviewed by a person, and the checklist shows what is missing. You must be 18 or over and payout-verified (Level 1) to receive money. We may change the criteria with notice, and we may remove creator status for breaches of these terms or the Community Guidelines.",
    ],
  },
  {
    id: "content",
    heading: "Your content",
    paragraphs: [
      "You keep ownership of what you post and give Zudomart the licence in the Terms of Service. You confirm that you own or have licensed everything in your content, including music, and that people who appear in it agreed.",
      "Label paid partnerships and gifted products clearly with the Paid partnership label, and follow the Ads Policy and the rules of the Advertising Regulatory Council of Nigeria (ARCON) on endorsements. Label AI-generated content honestly.",
    ],
  },
  {
    id: "earnings",
    heading: "How you earn",
    paragraphs: ["Zudomart does not pay for views. It shares eligible revenue with Creator Program members only:"],
    bullets: [
      "Gifts and tips: viewers spend coins on gifts and tips on your lives and content. You receive a share of each one that depends on your creator tier: 50% (Starter), 60% (Partner) or 70% (Top), set by your monthly gift volume. You receive it as earned coins, which you can convert to money in Creator Studio. Zudomart keeps the rest. [Team to confirm the tier thresholds shown in Creator Studio.]",
      "Fan subscriptions: you set the price and benefits. You keep 80% of what fans pay after the app store or payment processing fee. In the apps the price is raised to cover the store fee, so your share is the same as on the web.",
      "Ads revenue share: 40% of what advertisers pay for eligible ads shown with your posts and clips, including Promoted ads shown between replies in the comment sections of your posts, and in your lives if you turn live ads on. You do not earn from ads you see on your own posts.",
      "Premium pool: part of Premium subscription revenue goes into a pool each month, shared among creators according to how much time Premium members spend watching their content.",
    ],
  },
  {
    id: "what-changes-your-share",
    heading: "What changes your share",
    paragraphs: ["Your share can be lower, or paused, in these cases:"],
    bullets: [
      "AI-generated content earns 30% of the normal ads share, which is 12% of ad revenue at the default rate. [Team to confirm the multiplier before publishing.]",
      "Invalid traffic, such as fake, automated or bought views and clicks, is filtered out first. Advertisers are not charged for it and you are not paid for it.",
      "Strikes can pause monetisation. While it is paused you earn no gifts, tips, ads share, subscriptions or pool money, and comment-section ads on your posts still show, with the share kept by Zudomart. It comes back when strikes expire or an appeal succeeds. [Team to confirm: the code does not pause monetisation automatically at a strike threshold today; staff suspend Creator Program status by hand.]",
      "Rates are set by Zudomart and shown in Creator Studio under How you earn. We give at least 30 days' notice before lowering a rate, and a change never applies to earnings already made. [Team to confirm the notice period.]",
    ],
  },
  {
    id: "affiliates",
    heading: "Affiliate commissions",
    paragraphs: ["When a seller runs an affiliate program, you can share its products with your link and earn the commission the seller sets:"],
    bullets: [
      "Commissions are paid by the seller, not by Zudomart, and only on completed orders: the buyer confirms delivery, or 3 days pass after delivery with no dispute, return or refund request. Nothing is paid while the money is in escrow, and an order refunded, cancelled or returned before it completes pays nothing. A partial refund reduces the commission in proportion.",
      "The commission rate is locked when the buyer checks out, so later changes by the seller do not affect that order.",
      "Attribution is first click: the first creator link the buyer used for that product gets the sale, within the seller's attribution window, which is 30 days unless the seller sets another.",
      "You never earn a commission on your own purchases or on sales from your own store.",
      "If an order is refunded after your commission was paid, the commission is taken back from your wallet.",
      "Disclose that you earn commission when you promote products, as the Ads Policy and ARCON rules require.",
    ],
  },
  {
    id: "refunds",
    heading: "Refunds, chargebacks and reversals",
    paragraphs: [
      "Fan subscriptions: if Apple, Google or our payment partner refunds or charges back a fan's payment, your share of it is reversed, including from your wallet if it was already paid. Subscription earnings are held for 7 days, the chargeback window, before they become available.",
      "Gifts and tips: a gift or tip is final once sent. If a viewer's coin purchase is later refunded by Apple or Google, the viewer's coins are removed or recorded as owed, and your earned coins from gifts already sent are not reversed.",
      "Earnings from invalid activity, such as fake views, self-gifting, gifting rings or gifts paid with stolen cards, are not payable. We may hold them while we check and refuse to pay them out. [Team to confirm: there is no tool today to reverse earned coins from a specific gift; decide whether to build one.]",
      "If a reversal is larger than your balance, the rest shows as owed and comes out of your next earnings.",
    ],
  },
  {
    id: "payouts",
    heading: "Payouts and tax",
    paragraphs: [
      "Earnings are paid into your wallet held by our licensed payment partner in your name, and withdrawn to a verified account in your own name. Zudomart never holds your earnings. Earnings already earned and validated are never forfeited because you leave the program or close your account.",
      "You are responsible for your taxes. If the law requires us or our payment partner to withhold or report tax, we will, and we will tell you.",
      "[Team to replace: the earned-coin conversion rate and the minimum withdrawal amount.]",
    ],
  },
  {
    id: "conduct",
    heading: "Creator conduct",
    paragraphs: [
      "Do not pressure fans, especially young people, to gift, tip or subscribe, promise rewards you will not deliver, offer anything outside Zudomart in exchange for gifts, or deliver subscriber content that breaks the Community Guidelines. Subscriber-only content must match what the plan promised.",
      `Creator questions: ${emailAddresses.creators}.`,
    ],
  },
  {
    id: "ending",
    heading: "Leaving or losing creator status",
    paragraphs: [
      "You can leave the program at any time. If you leave or are removed, active fan subscriptions stop renewing and fans keep access until the end of their paid period. Earnings already earned and validated are still paid to you, unless they came from invalid activity or the law requires them to be held. You can appeal a removal from Settings, Account status.",
    ],
  },
];
