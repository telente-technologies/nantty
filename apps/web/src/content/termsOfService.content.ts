import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

import { generalLegalCreditParagraph, legalEntityPlaceholder } from "./legalPlaceholders.content";
import { termsOfServiceMoneySections } from "./termsOfServiceMoney.content";

export const termsOfServiceSections: readonly LegalDocumentSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    paragraphs: [
      `Nantty is operated by ${legalEntityPlaceholder}, a company registered in Nigeria (the "Company", "we", "us"). These terms apply when you use the Nantty mobile app, the Nantty web app, this website, the seller dashboard, Creator Studio and Nantty Ads.`,
      "By creating an account, or by using Nantty without an account, you agree to these terms. If you use Nantty for a business, you confirm that you can bind that business, and these terms apply to it too.",
      "These policies form part of these terms: the Privacy Policy, Cookie Policy, Community Guidelines, Refund and Escrow Policy, Copyright and IP Policy, and, when they apply to you, the Seller Terms, Creator Program Terms and Ads Policy. If they conflict, the more specific policy wins for its subject.",
      "These terms are written in English, and the English version controls.",
    ],
  },
  {
    id: "eligibility",
    heading: "Who can use Nantty",
    paragraphs: [
      "You must be at least 13 years old to have an account, or older where your local law sets a higher age for using online services without a parent's consent.",
      "We ask for your date of birth when you sign up. If you are under 18, you need the permission of a parent or guardian, who accepts these terms for you and is responsible for your use. In Nigeria, section 31 of the Nigeria Data Protection Act 2023 requires that consent for processing a child's data comes from a parent or guardian.",
      "Under-18 accounts never see nudity or dangerous content. They may receive contextual ads only from categories permitted for their age; those ads are not personalised or targeted using personal traits. Under-18 accounts cannot sell, receive payouts, join the Creator Program or run ads.",
      "You cannot use Nantty if we have permanently banned you, or if the law or sanctions rules that apply to us prevent us from serving you.",
    ],
  },
  {
    id: "accounts",
    heading: "Your account and verification",
    paragraphs: [
      "You sign in with your email address, or with Apple or Google linked to it; phone numbers are never used to log in. Keep your email account and login secure, give accurate information, and tell us at once if you think someone else has used your account. You are responsible for what happens on your account unless it was used without your permission and you were not careless.",
      "Accounts have verification levels. Level 0 means your email is confirmed. Level 1 (payout-verified) means your identity and a payout account in your own name are verified: in Nigeria with your BVN and bank account through our payment partner, and elsewhere through our identity partner Smile ID. Level 2 requires an approved Smile ID identity check using a method available for your country; this may involve a biometric photo-ID check or a hosted ID-number check. Some features need a particular level, and we tell you before you start.",
      "Verification lowers risk but is not a promise about anyone. We may ask you to verify again, and we may limit features while a check is pending.",
    ],
  },
  {
    id: "guests-and-privacy",
    heading: "Guests, public and private accounts",
    paragraphs: [
      "You can browse public posts, clips, lives, stores and products as a guest without an account. Guests cannot post, comment, chat, buy, send gifts or follow, and are not shown ads.",
      "Accounts are public unless you make yours private. If your account is private, people must send a follow request and you choose who to accept; only approved followers see your posts, stories, followers and following. Your name, photo and bio can still be found in search, and what you post in chats, in comments on public posts or elsewhere can be seen by the people there.",
    ],
  },
  {
    id: "usernames",
    heading: "Usernames",
    paragraphs: [
      "When you sign up, Nantty creates a username for you. You can change it in your account settings, but the number of changes in a period is limited, and the app shows when you can next change it.",
      "Some usernames are reserved and cannot be chosen, including names of Nantty products and teams, government bodies, well-known brands and public figures, and words that could mislead people about who they are dealing with.",
      "Your username does not belong to you. We may withhold, change or reclaim a username, including when it impersonates a person, brand, store or government body, breaks our policies, infringes a trademark or other rights, or when the law requires it. Where we can, we tell you first and let you choose a new one. A username you give up is held for 120 days before anyone else can take it, unless our staff reassign it to resolve an impersonation or trademark case.",
      "[Team to replace: the exact number of username changes allowed and the waiting period between changes.]",
    ],
  },
  {
    id: "our-role",
    heading: "What Nantty is, and is not",
    paragraphs: [
      "Nantty is a platform where people post, watch, chat, sell and buy. Products are sold by independent sellers, not by Nantty. When you buy, your contract for the goods is with the seller. We do not own, inspect, store or ship goods, and we do not provide delivery.",
      "We help in other ways: we verify sellers, show reviews and success rates, run escrow in Nigeria, review disputes and remove sellers who break the rules. Those steps reduce risk but do not make us the seller.",
    ],
  },
  ...termsOfServiceMoneySections,
  {
    id: "content",
    heading: "Your content and the licence you give us",
    paragraphs: [
      "You keep ownership of the posts, clips, stories, lives, comments, product listings and other content you create. You give Nantty a worldwide, non-exclusive, royalty-free licence to host, store, copy, adapt (for example to resize or caption), display, distribute and promote your content in Nantty and in marketing for Nantty, for as long as it is on Nantty and for a reasonable time after you delete it to clear backups and caches. The licence lets us run the service; it does not let us sell your content to others.",
      "Other users can view and share your public content inside Nantty, and quote or embed it where the feature allows. You confirm that you have the rights needed for everything you post, including music, images and the people who appear in it.",
      "If you label content as AI-generated, or we detect that it is, it shows an AI-generated label. AI-generated content earns a lower share of ads revenue under the Creator Program Terms.",
      "We do not use your chats to train any model, because we cannot read them.",
    ],
  },
  {
    id: "conduct",
    heading: "Rules for using Nantty",
    paragraphs: [
      "Follow the Community Guidelines and the law. In particular, do not: post illegal content or list prohibited items; harass, threaten or exploit anyone, especially children; impersonate others; scam, phish or run advance-fee fraud; fake reviews, followers or engagement; spam; scrape, reverse engineer or overload our systems; get around security checks, sales limits or verification; or use Nantty to launder money or evade sanctions.",
    ],
  },
  {
    id: "ranking",
    heading: "How we rank content",
    paragraphs: [
      "Your feed, trends and suggestions are based on what is trending and what you engage with. Engagement that looks fake, such as bots, coordinated groups, engagement pods or bought likes, is discounted and cannot make a post or hashtag trend.",
      "Accounts with a checkmark get a small ranking boost with a fixed upper limit: up to 15% for Black, 12% for Gold, 10% for Premium, 8% for Blue Verified and 5% for Blue Essential. Official accounts that Nantty created and verified show an Official label and get an extra editorial boost of up to 15%, never more than 25% in total. A post with much better engagement always outranks a boosted post with weak engagement.",
      "Nobody can pay for reach in the feed except through boosts and ads, which are always labelled. Nantty staff cannot push posts or trends. They can only demote or remove content for policy reasons, and every change is logged. You can see why a post was shown to you from its menu. Rankings of people (for example gift leaderboards) appear only inside live streams.",
    ],
  },
  {
    id: "chat",
    heading: "Chats are end-to-end encrypted",
    paragraphs: [
      "Messages, photos, videos and voice notes in Nantty chats, including group chats, are end-to-end encrypted. Nantty cannot read them. We still process information needed to deliver messages, such as who is in a chat, who sent each message and when, and we use it to fight spam and abuse without reading content. Locations and polls you share in a chat are not end-to-end encrypted, so we can see them.",
      "If you report a chat, your device sends only the messages you select to our safety team, with your permission. Chat media is deleted from our servers automatically after 30 days. You are responsible for what you send. Chats with our support team are not end-to-end encrypted, so we can help you, and they are logged.",
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
      "We may remove or limit content, restrict features, pause monetisation, hold back payouts where the law allows, or suspend or close accounts that break these terms or the law, or that put others at risk. The Community Guidelines set out our enforcement steps and strikes. Automated systems, including those that scan lives for severe harm, can flag, hide or temporarily limit, but never ban an account permanently on their own: a person reviews first.",
      "We tell you what we did, which rule it was under and why, unless the law or safety prevents it, and you can appeal from the app. A successful appeal removes the action and any strike. If a suspension stands, your profile, posts and media are deleted after 120 days, and order and payment records are anonymised and kept for the period the law requires. We report child sexual abuse material to the authorities.",
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
      "We work hard to keep Nantty running, safe and accurate, but we provide it as it is and as available. To the extent the law allows, we do not promise that it will always be available or error-free, or that content, listings or other users are accurate, lawful or safe. We are not responsible for goods sold by sellers, for content posted by users, or for third-party services such as payment partners, app stores and delivery companies, except where the law makes us responsible.",
    ],
  },
  {
    id: "liability",
    heading: "Limits of liability",
    paragraphs: [
      "Nothing in these terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, for fraud, or for breaching consumer rights that cannot be excluded.",
      "Subject to that, Nantty is not liable for indirect or consequential loss, loss of profit, revenue, goodwill or data, or for losses caused by sellers, other users, payment partners or events outside our reasonable control. Our total liability to you for all claims about Nantty in any 12 months is limited to the greater of the fees you paid to Nantty in those 12 months and ₦100,000 (or the equivalent in your currency).",
      "Money held for you by our payment partner is not part of this limit: it belongs to you, and we never deduct this cap from it.",
    ],
  },
  {
    id: "indemnity",
    heading: "Responsibility for your actions",
    paragraphs: [
      "If you use Nantty for business, you agree to cover our reasonable losses and legal costs from claims by others that result from your breach of these terms, your content, your products or your breach of the law. If you use Nantty as a consumer, this applies only to the extent your local law allows.",
    ],
  },
  {
    id: "ending",
    heading: "Closing your account",
    paragraphs: [
      "You can delete your account at any time in Settings, Privacy & Data. You have 30 days to change your mind by logging in; after that, your profile and content are deleted and your username is held for 120 days before anyone else can take it. Before you delete, withdraw available money and finish open orders and disputes. We may close accounts as set out in \"When we act on content and accounts\". Sections that by their nature should survive, such as the licence for content already shared, payment obligations, limits of liability and dispute resolution, continue after closure.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms when the product or the law changes. For a material change we tell you by email and in the app at least 30 days before it takes effect, with a summary of what changed, and we may ask you to accept the new version before you continue. We never apply a change to earnings or purchases you already made. If you do not agree, you can close your account before the change applies. After launch, earlier versions stay available on this page.",
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
      "We may transfer these terms to a company that takes over Nantty or the relevant part of it, and we will tell you. You may not transfer your account or these terms without our written consent. If a court finds part of these terms unenforceable, the rest stays in force. If we do not enforce a right at once, we can still enforce it later. These terms and the policies they mention are the whole agreement between you and us about Nantty.",
      "Neither of us is responsible for delay caused by events outside reasonable control, such as power or network failures, bank or payment partner outages, strikes, natural disasters or government action, as long as we try to limit the effect.",
    ],
  },
  {
    id: "contact",
    heading: "Contact and legal notices",
    paragraphs: [
      `Questions about these terms: ${emailAddresses.legal}. Formal legal notices to Nantty go to ${legalEntityPlaceholder}, with a copy to ${emailAddresses.legal}.`,
      "[Team to replace: the physical contact address in Nigeria and the liaison officer for government communications that the NITDA Code of Practice expects of large platforms.]",
    ],
  },
  {
    id: "credits",
    heading: "About this document",
    paragraphs: [generalLegalCreditParagraph],
  },
];
