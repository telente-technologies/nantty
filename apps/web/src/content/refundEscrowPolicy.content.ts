import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const refundEscrowPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "summary",
    heading: "In short",
    paragraphs: [
      "Zudomart never holds your money. In Nigeria, your payment stays locked in your own wallet, held by our licensed payment partner, until the order is confirmed. Outside Nigeria there is no escrow: you pay the seller directly and buy at your own risk. Your legal rights against the seller apply everywhere.",
    ],
  },
  {
    id: "escrow",
    heading: "How escrow works (Nigeria)",
    paragraphs: ["When you pay for an order in Nigeria:"],
    bullets: [
      "1. The money is locked in your own wallet. If you pay by card or bank transfer, it is moved into your wallet as soon as it settles and then locked.",
      "2. The seller ships and marks the order delivered.",
      "3. You confirm delivery, or escrow releases automatically 3 days after the order is marked delivered if you have not confirmed or opened a dispute.",
      "4. The money moves to the seller's wallet, minus the seller's fees (the escrow fee and the payment processing fee). Buyers never pay an escrow fee. Zudomart takes no commission on products.",
      "If the order is still not marked delivered 30 days after you paid, our staff review it, contact you and the seller, and decide whether to release the payment or refund you. The payment is not released automatically while that review is open.",
    ],
  },
  {
    id: "disputes",
    heading: "Disputes (Nigeria)",
    paragraphs: [
      "If an order is late, missing, damaged, wrong or not as described, open a dispute from the order before escrow releases, with photos and a description. A dispute pauses the release timer. The seller has 48 hours to respond. If you cannot agree, our team reviews the evidence from both sides and decides to refund you in full or in part, or to release payment to the seller. We tell both of you the reasons.",
      "If you missed the window, or a problem appears later, you still have your rights against the seller under the Federal Competition and Consumer Protection Act 2018, for example to return defective goods. Report it and we will help, including by moving money back from the seller's wallet where the seller agrees or our decision allows.",
    ],
  },
  {
    id: "refunds",
    heading: "How refunds are paid",
    paragraphs: [
      "Before release, a refund simply unlocks the full amount in your wallet, where you can spend or withdraw it (deposit holds apply to withdrawals). You can also ask for a card refund back to your card.",
      "After release, if you are refunded after the money reached the seller (for example after a late dispute decision or a return of defective goods), we recover the seller's portion, which is what the seller received, and refund that to you. Zudomart's escrow fee and the payment processing fee are not refunded. Your rights against the seller for the full price under the FCCPA are not affected.",
      "Card refunds can take up to 10 business days to appear, depending on your bank. For some bank transfer payments, we may ask you, in the app, for the account to refund. We never ask for this by email.",
      `If a refund has not arrived after 10 business days, contact support with the order attached, or ${emailAddresses.support}.`,
    ],
  },
  {
    id: "direct-payment",
    heading: "Direct payment to verified stores (Nigeria)",
    paragraphs: [
      "Some verified stores may offer direct payment. The seller is paid when the payment settles, and there is no escrow fee. The order completes automatically 3 days after it is marked delivered, unless you open a dispute or ask for a refund before then. You can still report the order, and our dispute process and your legal rights apply, but recovering money depends on the seller and our payment partner. If a refund is agreed, the seller repays it from their wallet.",
    ],
  },
  {
    id: "outside-nigeria",
    heading: "Outside Nigeria: no escrow, at your own risk",
    paragraphs: [
      "Escrow and buyer protection are not available outside Nigeria. You pay the seller directly through our payment partner, and Zudomart does not hold or control that money. Every seller outside Nigeria is identity-verified before they can sell, but that is not a guarantee.",
      "If something goes wrong, report the order. We can review your report, ask the seller to refund you, warn, restrict, suspend, freeze or ban the seller, report them to our payment partner and the authorities, and escalate your case to our payment partner for help. We cannot reverse payments or guarantee a refund. You may be able to ask your card issuer or bank for a chargeback. If our partner, your bank or your card issuer cannot recover the money, there may be nothing more we can do.",
      "Local consumer laws still give you rights against the seller, for example a 7-day cooling-off period for online purchases in South Africa (section 44 of the Electronic Communications and Transactions Act 2002), cancellation rights for internet agreements in Kenya's Consumer Protection Act 2012, and 14 days to withdraw from purchases from traders in the UK and EU.",
    ],
  },
  {
    id: "digital",
    heading: "Coins, gifts, subscriptions, checkmarks, boosts and ads",
    paragraphs: ["Digital purchases follow these rules. If you are in the UK or EU, you agree that digital content starts at once and you lose the 14-day withdrawal right once it starts."],
    bullets: [
      "Coins: unused coins bought on the web can be refunded only where the law requires it or the purchase was unauthorised. Coins bought in the iOS or Android app are refunded only by Apple or Google, under their rules. When a coin purchase is refunded, those coins are removed from your balance; if you already spent them, the missing coins are recorded as owed.",
      "Gifts, tips and coin transfers: final once sent and not refunded, except where the law requires it or the coins were used without your permission. Refunding the coins does not take back gifts already sent.",
      "ZudoPoints: never money, so there is nothing to refund.",
      "Subscriptions and Premium: cancel at any time and keep access until the end of the paid period. We do not refund part-used periods unless the law requires it.",
      "Checkmarks: if verification is rejected, a checkmark-only plan is refunded in full, and for plans with other perks we refund the checkmark share of the current period.",
      "Boosts and ads: spend that was not delivered is returned to your Zudomart Ads account. [Team to confirm whether undelivered spend paid from ad balance returns as ad balance or as ad credit; the code issues it as non-expiring ad credit.] Spend on ads removed for breaking the Ads Policy is not refunded unless the law requires it.",
      "Ad balance: unspent ad balance can be withdrawn after a 24-hour hold, to your wallet and then to your verified payout account, with any fee shown first. Ad credit is never refunded in cash or withdrawn.",
    ],
  },
  {
    id: "timelines",
    heading: "Timelines at a glance",
    paragraphs: ["These timelines apply in Nigeria unless stated."],
    table: {
      columns: ["Step", "Time"],
      rows: [
        ["Automatic escrow release", "3 days after the order is marked delivered"],
        ["Deadline to open a dispute", "Before escrow releases"],
        ["Direct order completes", "3 days after the order is marked delivered, unless disputed"],
        ["Order not delivered", "Staff review 30 days after payment"],
        ["Seller response to a dispute", "48 hours"],
        ["Seller funds locked after release", "24 hours"],
        ["Card refund arrival", "Up to 10 business days"],
        ["Deposit hold before withdrawal", "24 hours (72 hours for your first deposit)"],
        ["Creator subscription earnings hold", "7 days"],
        ["Ad balance withdrawal hold", "24 hours after top-up"],
        ["Our decision on a disputed order", "[Team to confirm the target time for a decision after the seller's response.]"],
      ],
    },
  },
];
