import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const sellerTermsSections: readonly LegalDocumentSection[] = [
  {
    id: "scope",
    heading: "Scope",
    paragraphs: [
      "These Seller Terms apply on top of the Terms of Service whenever you list or sell on Zudomart, as an individual or a business. They also cover anyone on your seller team. If they conflict with the Terms of Service on selling, these Seller Terms win.",
    ],
  },
  {
    id: "eligibility",
    heading: "Who can sell",
    paragraphs: [
      "You must be 18 or over. A business must be lawfully registered where the law requires, for example with the Corporate Affairs Commission in Nigeria.",
      "In Nigeria, you can open a store and sell before you are verified, but only through escrow and only up to a total sales limit set by Zudomart and shown in your dashboard. Your earnings accrue and stay yours, but you cannot withdraw until you are payout-verified (Level 1: BVN and a bank account in your own name, checked through our payment partner).",
      "Outside Nigeria, you must verify your identity with Smile ID and a payout account in your own name before you can list or sell anything. Accounts that try to get around this, for example by using someone else's details, are suspended.",
      "A Gold business checkmark needs business verification. We may ask for business documents at any time; uploading them does not block your store while they are reviewed.",
    ],
  },
  {
    id: "stores-business-pages-and-brands",
    heading: "Stores, business pages and brands",
    paragraphs: [
      "Each personal account can own one Store or one Business page, never both, plus one Brand. Business pages are for organisations that do not sell and cannot list products. If an account had more than this before the rule applied, nothing is deleted, but the extra profiles cannot post or add listings until the owner chooses which to keep or our team resolves it.",
      "A Brand sells only when its owner turns on selling for it. A brand storefront is a sales channel of that Brand and does not count as your Store. Brand selling follows these Seller Terms in full, including the wallet, escrow in Nigeria, identity verification before selling outside Nigeria, and the seller debt limits. If you turn selling off, your brand products and storefront are hidden and you cannot add new listings, but you must still complete open orders, and their payouts continue as normal.",
    ],
  },
  {
    id: "listings",
    heading: "Listings",
    paragraphs: [
      "List only items you have the right to sell, that are in stock or clearly marked as pre-order, and that are allowed under the Community Guidelines. Describe them accurately, including condition (new, used or refurbished), size, material, origin and any defects. Use your own photos or ones you have permission to use. Show the full price, including VAT if you charge it. Do not use fake discounts, fake scarcity or fake reviews.",
      "Products that need regulatory approval must show it, for example a NAFDAC registration number for food, cosmetics and supplements, and must meet Standards Organisation of Nigeria requirements.",
      "You can set prices per country. Products that cannot be shipped to a buyer's region are hidden from them.",
    ],
  },
  {
    id: "orders",
    heading: "Orders, shipping and delivery",
    paragraphs: [
      "Zudomart does not provide delivery. You set your delivery destinations, fees, free-delivery areas and thresholds. Delivery is charged once per seller order, not per item. Ship within the time you promise, add tracking where you can, keep the buyer updated, and mark the order delivered only when it is delivered.",
      "Risk in the goods stays with you until the buyer receives them. If goods are lost or damaged in transit, you deal with your courier and the buyer is refunded.",
      "Use the buyer's details only to fulfil the order. You are a separate data controller for them under the NDPA. Do not add buyers to marketing lists without their consent, and keep their data secure.",
    ],
  },
  {
    id: "escrow-and-payouts",
    heading: "Escrow, payouts and wallets",
    paragraphs: [
      "Zudomart never holds your money. Your wallet is held by our licensed payment partner in your name.",
      "In Nigeria, escrow orders: the buyer's payment stays locked in the buyer's own wallet until the buyer confirms delivery, or 3 days after delivery if there is no dispute. It then moves to your wallet, minus fees, is locked for 24 hours, and then becomes available to withdraw. Payouts go to a verified bank account in your own name, in the daily payout run or when you request a withdrawal.",
      "Verified stores in Nigeria may also offer direct payment where available. Direct payments reach you when the payment settles, with no escrow, and you remain responsible for refunds you owe.",
      "Outside Nigeria, there is no escrow. You are paid directly when the buyer's payment settles, and you are fully responsible for refunds you owe the buyer. If you fail to pay a refund, we may restrict or close your store and report you to our payment partner and the authorities.",
      "If a refund or chargeback happens after you were paid, we may move the amount back from your wallet up to your available balance. Any amount still owed is a debt you owe to the buyer or to us, as the case may be.",
    ],
  },
  {
    id: "fees",
    heading: "Fees and plans",
    paragraphs: [
      "Zudomart takes no commission on what you sell. Fees are shown in your dashboard before they apply:",
    ],
    bullets: [
      "Escrow fee: 1.5% of the seller order total including delivery, or 1% on the Business plan. No escrow fee is charged on any part that is refunded.",
      "Payment processing fee: our payment partner's actual fee for the buyer's payment, deducted from your payout on escrow and direct orders. Buyers never pay a checkout fee or escrow fee.",
      "Withdrawal fees, if our payment partner charges one, shown before you withdraw.",
      "Seller plans, sold on the web: Free (₦0), Pro (₦5,000 a month) and Business (₦15,000 a month), or local prices in other countries. Plans renew until you cancel, and you keep the plan until the end of the period you paid for.",
    ],
  },
  {
    id: "returns",
    heading: "Returns, refunds and your legal duties to buyers",
    paragraphs: [
      "Publish a clear returns policy on your store. Whatever it says, you must accept the return of goods that are defective, unsafe or not as described and refund or replace them, as section 122 of the Federal Competition and Consumer Protection Act 2018 and similar laws require. A blanket 'no refund' policy is not allowed for those cases.",
      "Respond to disputes within 48 hours with evidence. If we decide a dispute against you, the refund comes from the escrow or, if already released, from your wallet.",
      "If you sell to buyers in other countries, you must give them the rights their law requires, for example the 7-day cooling-off period for online purchases in South Africa and the 14-day right of withdrawal from traders in the UK and EU.",
    ],
  },
  {
    id: "tax",
    heading: "Tax",
    paragraphs: [
      "You are responsible for your own taxes, including income tax and, if you are registered, VAT on your sales under the Nigeria Tax Act 2025. If the law requires us or our payment partner to collect, withhold or report tax or seller information to the Nigeria Revenue Service or another tax authority, we will, and we will tell you. [Team to confirm with a tax adviser whether Zudomart has any marketplace collection or reporting duty under the Nigeria Tax Act 2025 and the Nigeria Tax Administration Act 2025.]",
    ],
  },
  {
    id: "trader-information",
    heading: "Business details shown to buyers",
    paragraphs: [
      "Where the law requires, for example for business sellers who sell to the UK, EU or US, we collect and verify your business name, address, contact details and registration number, and show some of them to buyers.",
    ],
  },
  {
    id: "store-rewards",
    heading: "Store rewards",
    paragraphs: [
      "You can offer rewards that you fund yourself, such as store credit on completed orders. Rewards can be used only as a discount in your store, are never cash, are reversed on refund, and must follow the rules you publish.",
    ],
  },
  {
    id: "enforcement",
    heading: "Performance and enforcement",
    paragraphs: [
      "We show your order success rate to buyers. Late shipping, high dispute rates, counterfeit or prohibited items, or asking buyers to pay outside Zudomart can lead to lower sales limits, loss of the checkmark, payout holds where the law allows, or store closure, as the Community Guidelines set out. You can appeal.",
      `Seller questions: ${emailAddresses.sellers}.`,
    ],
  },
];
