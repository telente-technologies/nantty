import type { LegalDocumentSection } from "@/components/legal/legalDocument";

export const termsOfServiceMoneySections: readonly LegalDocumentSection[] = [
  {
    id: "payments",
    heading: "Payments and wallets: Nantty never holds your money",
    paragraphs: [
      "Payments, wallets and payouts are provided by our licensed payment partner, Flutterwave. You never pay into a Nantty bank account.",
      "In Nigeria, your wallet balance is held by our payment partner in a wallet in your own name. Nantty does not hold, pool or lend it. We only instruct the partner to move money when you, or these terms, tell us to (for example, to pay a seller after delivery), and to collect our fees. The partner's own terms also apply to your wallet.",
      "Money you add to your wallet can be spent on Nantty straight away, but it can be withdrawn only after a short hold, normally 24 hours, or 72 hours for your first deposit. The hold protects you if someone uses a stolen bank account. Withdrawals go only to a verified account in your own name.",
      "Prices, fees and the total are shown before you pay. If we suspect fraud, money laundering or a breach of these terms, we may pause payments on Nantty and report to our payment partner and the authorities as the law requires. Your money is never forfeited to us: if your account is closed, money that is yours stays yours, subject to refunds you owe and any legal hold.",
      "If a refund or chargeback is taken from you after money reached your wallet and your balance cannot cover it, the rest shows as an amount owed to Nantty. It is repaid from your next earnings, and you cannot withdraw until it is cleared.",
    ],
  },
  {
    id: "buying",
    heading: "Buying in Nigeria: escrow and direct payment",
    paragraphs: [
      "Nantty takes no commission on products. Buyers never pay an escrow fee or a checkout fee. Sellers pay the escrow fee and the payment partner's processing fee, as the Seller Terms explain.",
      "Escrow orders: when you pay, the money is locked in your own wallet. It moves to the seller only when you confirm delivery, or 3 days after the order is marked delivered if you have not confirmed or opened a dispute. If the order is refunded before that, the full amount is unlocked in your wallet.",
      "Direct orders: some verified stores offer direct payment. The seller is paid when your payment settles, there is no escrow, and the order completes automatically 3 days after it is marked delivered unless you open a dispute or ask for a refund before then.",
      "Orders that never arrive: if an order is still not marked delivered 30 days after you paid, our staff review it, contact you and the seller, and decide whether to release the payment or refund you. The payment is not released automatically while that review is open.",
      "Refunds after the seller was paid: if you are refunded after the money reached the seller, we recover the seller's portion (what the seller received) and refund that to you. Nantty's escrow fee and the payment processing fee are not refunded.",
      "Open a dispute before escrow releases if an order is late, missing, damaged, wrong or not as described. The full process and timelines are in the Refund and Escrow Policy.",
    ],
  },
  {
    id: "outside-nigeria",
    heading: "Buying and selling outside Nigeria",
    paragraphs: [
      "Outside Nigeria, escrow and buyer protection are not available. You pay the seller directly at checkout through our payment partner, and the seller is paid as soon as the payment settles. Nantty does not hold, control or guarantee the money. You buy and sell at your own risk.",
      "Every seller outside Nigeria must verify their identity and a payout account in their own name before they can list or sell anything. Verification lowers risk but is not a guarantee about a seller or their goods.",
      "If something goes wrong, what Nantty can do is limited to: reviewing your report; asking the seller to refund you; warning, restricting, suspending, freezing or banning the seller's account where the law and our partner allow; reporting the seller to our payment partner and, where appropriate, the authorities; and escalating your case to our payment partner so it can help you.",
      "Nantty cannot reverse a payment, force a refund or recover money already paid out. Recovery depends on our payment partner, your card issuer or bank, or your mobile money provider, for example through a chargeback. If they cannot help, there may be nothing more Nantty can do.",
      "This section does not take away rights that the law of your country gives you against the seller and that cannot be excluded by contract. See \"Your consumer rights\" below.",
    ],
  },
  {
    id: "selling",
    heading: "Selling",
    paragraphs: [
      "Sellers must describe products accurately, set their own delivery areas and fees, ship on time, honour their returns policy and the law, and follow the prohibited items list in the Community Guidelines. The Seller Terms apply to everyone who sells.",
      "In Nigeria, you can open a store and sell before you are verified, but only through escrow and up to a sales limit shown in your dashboard, and you cannot withdraw until you are verified. Your earnings stay yours while you wait. Outside Nigeria, you must be verified before you can sell.",
    ],
  },
  {
    id: "coins-and-gifts",
    heading: "Coins, gifts and tips",
    paragraphs: [
      "Coins are a licence to use digital features on Nantty, such as sending gifts and tips on lives and content. Coins are not money, not a deposit and not e-money. They cannot be withdrawn, exchanged for cash or used to pay for products, and they have no value outside Nantty.",
      "Coin prices are set per channel and per country. The same pack can cost more in the iOS or Android app than on the web because Apple and Google charge a fee, and the iOS and Android prices can differ from each other. The price is shown before you buy.",
      "You can send coins to another person. A platform fee of 25% of the coins sent is taken from the transfer, and the review step shows the exact numbers before you confirm. Transfers are final, and the person you send to cannot withdraw them either.",
      "A gift or tip uses up your coins when you send it. It is final and is not refunded once sent, except where the law requires it or the coins were used without your permission. Creators receive a share of each gift or tip under the Creator Program Terms.",
      "If Apple or Google refunds a coin purchase, we remove those coins from your balance. If you already spent them, the missing coins are recorded as coins you owe, your account may be reviewed, and gifts you already sent stay with the creator. Card or bank coin purchases on the web are refunded only by our staff, with the same result.",
      "Do not buy, sell or trade coins or gifts outside Nantty, use them to gamble or pay for goods, or use them to move money. We may freeze or remove coins involved in fraud, chargebacks or a breach of these terms.",
    ],
  },
  {
    id: "nantty-points",
    heading: "Nantty Points",
    paragraphs: [
      "Nantty Points reward taking part, for example watching and engaging with lives. They are never money: they cannot be bought, sold, transferred for value, converted into coins or cash, or withdrawn. We may change how they are earned and used, or reset points earned through fake activity.",
    ],
  },
  {
    id: "subscriptions-and-checkmarks",
    heading: "Premium, plans, checkmarks and offers",
    paragraphs: [
      "In the iOS and Android apps, digital purchases (coins, Premium, Blue plans and creator subscriptions) are sold through the Apple App Store or Google Play. Their price includes the store's fee, so it can be higher than on the web. Apple's or Google's terms and refund processes apply to those purchases, and a refund they give may reverse what was bought with it. Seller plans and Gold are sold only on the web.",
      "Subscriptions renew automatically until you cancel. You can cancel at any time and keep access until the end of the period you paid for. Plans renew at the full price shown at renewal. If we raise a price, we tell you before your next renewal and the new price applies from the following period, so you can cancel first.",
      "A checkmark is given only after the required identity verification is approved. Depending on the method available for your country, Smile ID may verify a photo ID and liveness or perform a hosted ID-number check. We obtain explicit consent before biometric processing. Paying never buys a checkmark on its own. If verification is rejected, a checkmark-only plan is refunded in full; for plans with other perks, those perks keep running and we refund the checkmark share of the current period. A checkmark is personal and cannot be transferred, and changing your verified name may pause it until it is checked again.",
      "Premium members can own up to 5 business profiles, but never more than one Store. Some business plans can be bought together as a combined Gold plan at a discount shown at checkout.",
      "Offer links: an offer link can be claimed once per account, and discounts never stack. If more than one discount applies, you get the single best one.",
    ],
  },
  {
    id: "ads-and-boosts",
    heading: "Ads, boosts, ad balance and ad credit",
    paragraphs: [
      "A boost pays to show your own post, profile or store to more people. Boosted posts are labelled Boosted. Ads bought in Nantty Ads are labelled Sponsored, and ads in comment sections are labelled Promoted. Premium members get 1 free boost each month.",
      "Ad balance is real money you top up to pay for ads. Unspent ad balance can be withdrawn after a 24-hour hold, once you are payout-verified, to your Nantty wallet and from there to your verified payout account. Any fee is shown before you confirm.",
      "Ad credit is promotional value that can only be spent on ads in Nantty. It is never money and can never be withdrawn or transferred. Credit we give you, for example as a promotion or goodwill, may have an expiry date that we show when we give it. Credit you earn in the app, such as cashback, never expires. Selected advertisers can receive 10% of their ad spend back as ad credit.",
      "How many ads you see depends on your plan, as the Ads Policy explains. Guests are not shown ads. Under-18s may receive contextual, age-appropriate ads, but not personalised ads or ads from restricted categories.",
    ],
  },
];
