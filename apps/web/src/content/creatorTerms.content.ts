import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const creatorTermsSections: readonly LegalDocumentSection[] = [
  {
    id: "program",
    heading: "The Creator Program",
    paragraphs: [
      "These terms apply on top of the Terms of Service when your personal profile is approved for the Creator Program. Creator status is an upgrade to your personal profile, not a separate account.",
      "Eligibility is based on criteria shown in Creator Studio, such as real followers, account age, policy record and risk checks. Some accounts are approved automatically, some are reviewed by a person, and the checklist shows what is missing. You must be 18 or over and payout-verified (Level 1) to receive money. We may change the criteria with notice, and we may remove creator status for breaches of these terms or the Community Guidelines.",
    ],
  },
  {
    id: "content",
    heading: "Your content",
    paragraphs: [
      "You keep ownership of what you post and give Zudomart the licence in the Terms of Service. You confirm that you own or have licensed everything in your content, including music, and that people who appear in it agreed.",
      "Label paid partnerships and gifted products clearly with the Paid partnership label, and follow the Ads Policy and the rules of the Advertising Regulatory Council of Nigeria (ARCON) on endorsements. Label AI-generated content.",
    ],
  },
  {
    id: "earnings",
    heading: "How you earn",
    paragraphs: ["Zudomart does not pay for views. It shares eligible revenue with creators:"],
    bullets: [
      "Gifts: viewers buy coins and send gifts on your lives and content. You receive a share of each gift's value that depends on your creator tier, up to 70%, as earned coins, which you can convert to money in Creator Studio.",
      "Fan subscriptions: you set the price and benefits. You keep 80% of what fans pay after the app store or payment processing fee.",
      "Ads revenue share: a share of the revenue from eligible ads shown with your content, and in your lives if you turn live ads on. Views are filtered for fraud first. AI-generated content earns a lower share than original content.",
      "Premium pool: part of Premium subscription revenue is shared among creators according to how much Premium members watch their content.",
    ],
  },
  {
    id: "in-app-purchases",
    heading: "Subscriptions and coins bought in the apps",
    paragraphs: [
      "In the iOS and Android apps, fans pay for subscriptions and coins through Apple or Google. The in-app price is the web price grossed up by the store's fee, so your net share is the same as on the web. If Apple or Google refunds a fan, the matching earnings are reversed, including from your wallet if they were already paid.",
      "Subscription earnings are held for 7 days, the chargeback window, before they become available. Coins are not money; only earned coins from gifts can be converted, at the rate shown in Creator Studio.",
    ],
  },
  {
    id: "payouts",
    heading: "Payouts",
    paragraphs: [
      "Earnings are paid into your wallet held by our licensed payment partner in your name, and withdrawn to a verified account in your own name. Zudomart never holds your earnings. Earnings from invalid activity, such as fake views, bought gifts, self-gifting or gifts paid with stolen cards, are not payable and may be reversed.",
      "You are responsible for your taxes. If the law requires us to withhold or report tax, we will.",
      "[Team to replace: the exact gift share for each creator tier, the ads revenue share percentage, the AI-generated content multiplier, the earned-coin conversion rate and the minimum withdrawal amount.]",
    ],
  },
  {
    id: "conduct",
    heading: "Creator conduct",
    paragraphs: [
      "Do not pressure fans, especially young people, to gift or subscribe, promise rewards you will not deliver, or deliver subscriber content that breaks the Community Guidelines. Subscriber-only content must match what the plan promised.",
      `Creator questions: ${emailAddresses.creators}.`,
    ],
  },
  {
    id: "ending",
    heading: "Leaving or losing creator status",
    paragraphs: [
      "You can leave the program at any time. If you leave or are removed, active fan subscriptions stop renewing and fans keep access until the end of their paid period. Earnings already earned and validated are still paid to you, unless they came from invalid activity or the law requires them to be held.",
    ],
  },
];
