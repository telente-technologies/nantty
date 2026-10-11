import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

import { generalLegalCreditParagraph, legalEntityPlaceholder } from "./legalPlaceholders.content";

export const termsOfServiceSections: readonly LegalDocumentSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    paragraphs: [
      `Zudomart is operated by ${legalEntityPlaceholder}, a company registered in Nigeria ("Zudomart", "we", "us"). These terms apply when you use the Zudomart mobile app, the Zudomart web app, this website, the seller dashboard, Creator Studio and Zudomart Ads.`,
      "By creating an account, or by using Zudomart without an account, you agree to these terms. If you use Zudomart for a business, you confirm that you can bind that business, and these terms apply to it too.",
      "These policies form part of these terms: the Privacy Policy, Cookie Policy, Community Guidelines, Refund and Escrow Policy, Copyright and IP Policy, and, when they apply to you, the Seller Terms, Creator Program Terms and Ads Policy. If they conflict, the more specific policy wins for its subject.",
      "These terms are written in English, and the English version controls.",
    ],
  },
  {
    id: "eligibility",
    heading: "Who can use Zudomart",
    paragraphs: [
      "You must be at least 13 years old to have an account, or older where your local law sets a higher age for using online services without a parent's consent. [Team to confirm the minimum age with counsel: 13 is the working proposal.]",
      "If you are under 18, you need the permission of a parent or guardian, who accepts these terms for you and is responsible for your use. In Nigeria, the Nigeria Data Protection Act 2023 requires that consent for processing a child's data comes from a parent or guardian. Under-18 accounts never see nudity or dangerous content, are not shown personalised ads, and cannot sell, receive payouts, join the Creator Program or run ads. [Team to confirm whether under-18s may go live, buy coins or send gifts.]",
      "You cannot use Zudomart if we have permanently banned you, or if the law or sanctions rules that apply to us prevent us from serving you.",
    ],
  },
  {
    id: "accounts",
    heading: "Your account and verification",
    paragraphs: [
      "You sign in with your email address. Keep your email account and login secure, give accurate information, and tell us at once if you think someone else has used your account. You are responsible for what happens on your account unless it was used without your permission and you were not careless.",
      "Accounts have verification levels. Level 0 means your email is confirmed. Level 1 (payout-verified) means your identity and a payout account in your own name are verified: in Nigeria with your BVN and bank account through our payment partner, and elsewhere through our identity partner Smile ID. Level 2 adds a Smile ID biometric check and is needed for a checkmark. Some features need a particular level, and we tell you before you start.",
      "Verification lowers risk but is not a promise about anyone. We may ask you to verify again, and we may limit features while a check is pending.",
    ],
  },
  {
    id: "usernames",
    heading: "Usernames",
    paragraphs: [
      "When you sign up, Zudomart creates a username for you. You can change it in your account settings, but the number of changes in a period is limited, and the app shows when you can next change it.",
      "Some usernames are reserved and cannot be chosen, including names of Zudomart products and teams, government bodies, well-known brands and public figures, and words that could mislead people about who they are dealing with.",
      "Your username does not belong to you. We may withhold, change or reclaim a username, including when it impersonates a person, brand, store or government body, breaks our policies, infringes a trademark or other rights, or when the law requires it. Where we can, we tell you first and let you choose a new one. A username you give up is held for 120 days before anyone else can take it, unless our staff reassign it to resolve an impersonation or trademark case.",
      "[Team to replace: the exact number of username changes allowed and the waiting period between changes.]",
    ],
  },
  {
    id: "our-role",
    heading: "What Zudomart is, and is not",
    paragraphs: [
      "Zudomart is a platform where people post, watch, chat, sell and buy. Products are sold by independent sellers, not by Zudomart. When you buy, your contract for the goods is with the seller. We do not own, inspect, store or ship goods, and we do not provide delivery.",
      "We help in other ways: we verify sellers, show reviews and success rates, run escrow in Nigeria, review disputes and remove sellers who break the rules. Those steps reduce risk but do not make us the seller.",
    ],
  },
  {
    id: "payments",
    heading: "Payments and wallets: Zudomart never holds your money",
    paragraphs: [
      "Payments, wallets and payouts are provided by our licensed payment partner, Flutterwave. You never pay into a Zudomart bank account.",
      "In Nigeria, your wallet balance is held by our payment partner in a wallet in your own name. Zudomart does not hold, pool or lend it. We only instruct the partner to move money when you, or these terms, tell us to (for example, to pay a seller after delivery), and to collect our fees. The partner's own terms also apply to your wallet.",
      "Money you add to your wallet can be spent on Zudomart straight away, but it can be withdrawn only after a short hold, normally 24 hours, or 72 hours for your first deposit. The hold protects you if someone uses a stolen bank account. Withdrawals go only to a verified account in your own name.",
      "Prices, fees and the total are shown before you pay. If we suspect fraud, money laundering or a breach of these terms, we may pause payments on Zudomart and report to our payment partner and the authorities as the law requires. Your money is never forfeited to us: if your account is closed, money that is yours stays yours, subject to refunds you owe and any legal hold.",
    ],
  },
  {
    id: "buying",
    heading: "Buying in Nigeria: escrow",
    paragraphs: [
      "In Nigeria, when you pay for an order, the money is locked in your own wallet as escrow. It moves to the seller only when you confirm delivery, or 3 days after the order is marked delivered if you have not confirmed or opened a dispute. If the order is refunded, the money is unlocked in your wallet.",
      "Open a dispute before escrow releases if an order is late, missing, damaged, wrong or not as described. The full process and timelines are in the Refund and Escrow Policy.",
      "Some verified stores may also offer direct payment. If you choose it, there is no escrow, and you rely on your rights against the seller and on our dispute process.",
    ],
  },
  {
    id: "outside-nigeria",
    heading: "Buying and selling outside Nigeria",
    paragraphs: [
      "Outside Nigeria, escrow and buyer protection are not available. You pay the seller directly at checkout through our payment partner, and the seller is paid as soon as the payment settles. Zudomart does not hold, control or guarantee the money. You buy and sell at your own risk.",
      "Every seller outside Nigeria must verify their identity and a payout account in their own name before they can list or sell anything. Verification lowers risk but is not a guarantee about a seller or their goods.",
      "If something goes wrong, what Zudomart can do is limited to: reviewing your report; asking the seller to refund you; warning, restricting, suspending, freezing or banning the seller's account where the law and our partner allow; reporting the seller to our payment partner and, where appropriate, the authorities; and escalating your case to our payment partner so it can help you.",
      "Zudomart cannot reverse a payment, force a refund or recover money already paid out. Recovery depends on our payment partner, your card issuer or bank, or your mobile money provider, for example through a chargeback. If they cannot help, there may be nothing more Zudomart can do.",
      "This section does not take away rights that the law of your country gives you against the seller and that cannot be excluded by contract. See \"Your consumer rights\" below.",
    ],
  },
  {
    id: "selling",
    heading: "Selling",
    paragraphs: [
      "Sellers must describe products accurately, ship on time, honour their returns policy and the law, and follow the prohibited items list in the Community Guidelines. The Seller Terms apply to everyone who sells.",
      "In Nigeria, you can open a store and sell before you are verified, but only through escrow and up to a sales limit shown in your dashboard, and you cannot withdraw until you are verified. Your earnings stay yours while you wait. Outside Nigeria, you must be verified before you can sell.",
    ],
  },
  {
    id: "digital-purchases",
    heading: "Coins, gifts, subscriptions, checkmarks and boosts",
    paragraphs: [
      "Coins are a licence to use a digital feature, not money. You cannot withdraw, transfer for cash or exchange coins, and they have no cash value except that gifts a creator earns can be converted to cash under the Creator Program Terms. ZudoPoints are never money and cannot be bought, sold or withdrawn.",
      "In the iOS and Android apps, digital purchases (coins, Premium, checkmark plans bought in the app, creator subscriptions and in-app boosts) are sold through the Apple App Store or Google Play. Their price includes the store's fee, so it can be higher than on the web. Apple's or Google's terms and refund processes apply to those purchases, and a refund they give may reverse coins or benefits bought with it.",
      "Subscriptions renew automatically until you cancel. You can cancel at any time and keep access until the end of the period you paid for. Plans always renew at the full price shown at renewal. If a checkmark verification is rejected, your plan keeps running and we refund the checkmark share of the current period.",
      "A boost pays to show your own post to more people. Boosted posts are labelled Boosted. Ads bought in Zudomart Ads are labelled Sponsored. Premium members get 1 free boost each month.",
    ],
  },
  {
    id: "content",
    heading: "Your content and the licence you give us",
    paragraphs: [
      "You keep ownership of the posts, clips, stories, lives, comments, product listings and other content you create. You give Zudomart a worldwide, non-exclusive, royalty-free licence to host, store, copy, adapt (for example to resize or caption), display, distribute and promote your content in Zudomart and in marketing for Zudomart, for as long as it is on Zudomart and for a reasonable time after you delete it to clear backups and caches. The licence lets us run the service; it does not let us sell your content to others.",
      "Other users can view and share your public content inside Zudomart, and quote or embed it where the feature allows. You confirm that you have the rights needed for everything you post, including music, images and the people who appear in it.",
      "If you label content as AI-generated, or we detect that it is, it shows an AI-generated label.",
    ],
  },
  {
    id: "conduct",
    heading: "Rules for using Zudomart",
    paragraphs: [
      "Follow the Community Guidelines and the law. In particular, do not: post illegal content or list prohibited items; harass, threaten or exploit anyone, especially children; impersonate others; scam, phish or run advance-fee fraud; fake reviews, followers or engagement; spam; scrape, reverse engineer or overload our systems; get around security checks, sales limits or verification; or use Zudomart to launder money or evade sanctions.",
    ],
  },
  {
    id: "ranking",
    heading: "How we rank content",
    paragraphs: [
      "Your feed, trends and suggestions are based on what is trending and what you engage with. Engagement that looks fake, such as bots, coordinated groups, engagement pods or bought likes, is discounted and cannot make a post or hashtag trend.",
      "Accounts with a checkmark get a small ranking boost with a fixed upper limit: up to 15% for Black, 12% for Gold, 10% for Premium, 8% for Blue Verified and 5% for Blue Essential. Official accounts that Zudomart created and verified show an Official label and get an extra editorial boost of up to 15%, never more than 25% in total. A post with much better engagement always outranks a boosted post with weak engagement.",
      "Nobody can pay for reach in the feed except through boosts and ads, which are always labelled. Zudomart staff cannot push posts or trends. They can only demote or remove content for policy reasons, and every change is logged. You can see why a post was shown to you from its menu. Rankings of people (for example gift leaderboards) appear only inside live streams.",
    ],
  },
  {
    id: "chat",
    heading: "Chats are end-to-end encrypted",
    paragraphs: [
      "Messages in Zudomart chats are end-to-end encrypted. Zudomart cannot read them. We still process information needed to deliver messages, such as who you message and when, and we use it to fight spam and abuse without reading content.",
      "If you report a chat, your device sends the messages you choose to our safety team with your permission. Chat media is deleted automatically after 30 days. You are responsible for what you send. Chats with our support team are not end-to-end encrypted, so we can help you, and they are logged.",
    ],
  },
  {
    id: "copyright",
    heading: "Copyright, trademarks and counterfeits",
    paragraphs: [
      "Only post content and list products you have the right to use and sell. Do not sell counterfeit or replica goods or use someone else's brand to sell your own.",
      `Rights owners can report infringement from the post, clip, live or product menu, or by email to ${emailAddresses.copyright}. Our Copyright and IP Policy explains the notice, counter-notice and repeat infringer process, which follows Part VII of the Copyright Act 2022.`,
    ],
  },
  {
    id: "enforcement",
    heading: "When we act on content and accounts",
    paragraphs: [
      "We may remove or limit content, restrict features, hold back payouts where the law allows, or suspend or close accounts that break these terms or the law, or that put others at risk. The Community Guidelines set out our enforcement steps. Automated systems can flag or temporarily limit, but a person reviews before any permanent ban.",
      "We tell you what we did and why, unless the law or safety prevents it, and you can appeal from the app. If a suspension stands, your profile, posts, media and messages are deleted after 120 days, and order and payment records are anonymised and kept for the period the law requires.",
      "We remove unlawful content when a court, or a government agency authorised by law, orders us to, and we act on complaints as the Code of Practice for Interactive Computer Service Platforms issued by NITDA expects, including removing non-consensual intimate images within 24 hours of being told.",
    ],
  },
  {
    id: "consumer-rights",
    heading: "Your consumer rights",
    paragraphs: [
      "Nothing in these terms takes away rights you have by law that cannot be excluded by contract. In Nigeria, that includes your rights under the Federal Competition and Consumer Protection Act 2018, such as the right to information in plain language, the right to return goods that are defective or not as described, and protection from unfair or unjust terms. You can complain to the Federal Competition and Consumer Protection Commission (FCCPC) at any time.",
      "If you live in Ghana, Kenya, South Africa, the United Kingdom, the European Union or the United States, the consumer laws of your country that cannot be excluded also apply, for example the cancellation rights for online purchases in Kenya's Consumer Protection Act 2012, South Africa's Electronic Communications and Transactions Act 2002 and Consumer Protection Act 2008, and the 14-day right of withdrawal from traders in the UK and EU. Those rights are owed by the seller, and we show sellers' business details where the law requires it.",
    ],
  },
  {
    id: "disclaimers",
    heading: "What we do not promise",
    paragraphs: [
      "We work hard to keep Zudomart running, safe and accurate, but we provide it as it is and as available. To the extent the law allows, we do not promise that it will always be available or error-free, or that content, listings or other users are accurate, lawful or safe. We are not responsible for goods sold by sellers, for content posted by users, or for third-party services such as payment partners, app stores and delivery companies, except where the law makes us responsible.",
    ],
  },
  {
    id: "liability",
    heading: "Limits of liability",
    paragraphs: [
      "Nothing in these terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, for fraud, or for breaching consumer rights that cannot be excluded.",
      "Subject to that, Zudomart is not liable for indirect or consequential loss, loss of profit, revenue, goodwill or data, or for losses caused by sellers, other users, payment partners or events outside our reasonable control. Our total liability to you for all claims about Zudomart in any 12 months is limited to the greater of the fees you paid to Zudomart in those 12 months and ₦100,000 (or the equivalent in your currency). [Team to confirm the liability cap with counsel.]",
      "Money held for you by our payment partner is not part of this limit: it belongs to you, and we never deduct this cap from it.",
    ],
  },
  {
    id: "indemnity",
    heading: "Responsibility for your actions",
    paragraphs: [
      "If you use Zudomart for business, you agree to cover our reasonable losses and legal costs from claims by others that result from your breach of these terms, your content, your products or your breach of the law. If you use Zudomart as a consumer, this applies only to the extent your local law allows.",
    ],
  },
  {
    id: "ending",
    heading: "Closing your account",
    paragraphs: [
      "You can delete your account at any time in Settings, Privacy & Data. You have 30 days to change your mind by logging in. Before you delete, withdraw available money and finish open orders and disputes. We may close accounts as set out in \"When we act on content and accounts\". Sections that by their nature should survive, such as the licence for content already shared, payment obligations, limits of liability and dispute resolution, continue after closure.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms when the product or the law changes. For a material change we tell you by email and in the app at least 30 days before it takes effect, and we may ask you to accept the new version before you continue. If you do not agree, you can close your account before the change applies. Earlier versions stay available on this page.",
    ],
  },
  {
    id: "disputes",
    heading: "Governing law and resolving disputes",
    paragraphs: [
      "These terms are governed by the laws of the Federal Republic of Nigeria.",
      `Talk to us first. Most problems can be fixed through the Help Centre or by writing to ${emailAddresses.legal}. If a dispute is not resolved within 30 days of your written notice, either of us may propose mediation, which is voluntary under the Arbitration and Mediation Act 2023.`,
      "If the dispute is still not resolved, it will be finally settled by arbitration under the Arbitration and Mediation Act 2023, before a sole arbitrator, with the seat of arbitration in Lagos, Nigeria, in English. [Team to choose the arbitral rules and appointing institution with counsel, for example the Lagos Court of Arbitration.] Hearings may be held online. Any court with jurisdiction may enter judgment on the award.",
      "This does not stop: either of us from bringing an individual claim in a small claims court, such as the Lagos State small claims court, where it qualifies; you from complaining to a regulator such as the FCCPC, the Nigeria Data Protection Commission or the Central Bank of Nigeria through our payment partner; either of us from asking a court for urgent relief, for example to stop a breach of intellectual property; or, if you are a consumer outside Nigeria, you from using the courts and mandatory consumer laws of the country where you live.",
      "[Team to confirm with counsel whether to add a class action waiver and an arbitration opt-out for United States users, and how arbitration applies to consumers in each launch country.]",
    ],
  },
  {
    id: "electronic",
    heading: "Electronic communications and records",
    paragraphs: [
      "You agree that we can give you notices electronically, by email or in the app, and that clicking to accept, typing your name or using a verified account can form an electronic signature. Our electronic records of orders, payments, acceptances and messages to support may be used as evidence, as section 84 and section 93 of the Evidence Act 2011 (as amended in 2023) and section 17 of the Cybercrimes (Prohibition, Prevention, etc.) Act 2015 allow.",
    ],
  },
  {
    id: "general",
    heading: "General",
    paragraphs: [
      "We may transfer these terms to a company that takes over Zudomart or the relevant part of it, and we will tell you. You may not transfer your account or these terms without our written consent. If a court finds part of these terms unenforceable, the rest stays in force. If we do not enforce a right at once, we can still enforce it later. These terms and the policies they mention are the whole agreement between you and us about Zudomart.",
      "Neither of us is responsible for delay caused by events outside reasonable control, such as power or network failures, bank or payment partner outages, strikes, natural disasters or government action, as long as we try to limit the effect.",
    ],
  },
  {
    id: "contact",
    heading: "Contact and legal notices",
    paragraphs: [
      `Questions about these terms: ${emailAddresses.legal}. Formal legal notices to Zudomart go to ${legalEntityPlaceholder}, with a copy to ${emailAddresses.legal}.`,
      "[Team to replace: the physical contact address in Nigeria and the liaison officer for government communications that the NITDA Code of Practice expects of large platforms.]",
    ],
  },
  {
    id: "credits",
    heading: "About this document",
    paragraphs: [generalLegalCreditParagraph],
  },
];
