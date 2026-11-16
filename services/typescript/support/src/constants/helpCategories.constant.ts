import type { TicketCategory } from "../enums/ticket.enum.js";

export interface HelpCategorySeed {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
}

export const helpCategorySeeds: readonly HelpCategorySeed[] = [
  { slug: "getting-started", title: "Getting started", description: "What Nantty is, browsing as a guest and finding your way around the app and web.", iconName: "compass" },
  { slug: "account-and-login", title: "Account and login", description: "Signing up, signing in, passwords, two-factor authentication, usernames and sessions.", iconName: "userCircle" },
  { slug: "profiles-and-privacy", title: "Profiles and privacy", description: "Personal, creator, business and government profiles, private accounts, followers and blocking.", iconName: "identification" },
  { slug: "posts-and-feed", title: "Posts and feed", description: "Your feed, posting, comments, threads, reposts and quotes, pinning, mentions, bookmarks, views and sensitive content.", iconName: "squaresFour" },
  { slug: "clips-and-stories", title: "Clips and stories", description: "Watching and making clips, the player controls, landscape videos, and who sees and replies to your stories.", iconName: "filmStrip" },
  { slug: "chat", title: "Chat and messages", description: "Message requests, spam, chat passcode, streaks, disappearing media, encryption and reporting chats.", iconName: "chatCircle" },
  { slug: "live", title: "Live", description: "Going live, streaming software, guests, battles, gifts, Nantty Points, goals and live safety.", iconName: "broadcast" },
  { slug: "creators-and-earnings", title: "Creators and earnings", description: "The Creator Program, earnings, fan subscriptions, payout setup and withdrawals.", iconName: "star" },
  { slug: "checkmarks-and-verification", title: "Checkmarks and verification", description: "Blue, Gold and Black checkmarks, who can get them, prices and business documents.", iconName: "sealCheck" },
  { slug: "selling", title: "Selling on Nantty", description: "The seller dashboard, plans, products, inventory, orders, shipping, escrow, fees, rewards and payouts.", iconName: "storefront" },
  { slug: "business-and-brands", title: "Business and brands", description: "Business and brand profiles, Gold-only brand pages, government accounts, switching profiles and marketing emails.", iconName: "buildings" },
  { slug: "buying-and-orders", title: "Buying and orders", description: "Cart, shipping, checkout, escrow protection, confirming delivery, disputes and refunds.", iconName: "shoppingBag" },
  { slug: "payments-and-wallet", title: "Payments, coins and Premium", description: "Your wallet, adding money, payment methods, saved cards, coins, Premium, subscriptions and receipts.", iconName: "wallet" },
  { slug: "wallet-security", title: "Wallet security", description: "Who holds your money, step-up codes, withdrawal limits, new payout accounts, deposit holds and payment scams.", iconName: "lockKey" },
  { slug: "ads-and-boosts", title: "Ads and boosts", description: "Boosting posts, Ads Manager campaigns, ad review and how ads revenue is shared.", iconName: "megaphone" },
  { slug: "notifications-and-settings", title: "Notifications and settings", description: "Push, in-app and email notifications, dark mode, language and currency.", iconName: "gear" },
  { slug: "widgets-and-embeds", title: "Widgets and embeds", description: "Home-screen widgets on iPhone and Android, and the website embed for sellers and creators.", iconName: "appWindow" },
  { slug: "accessibility", title: "Accessibility", description: "Screen readers, text size, captions, alt text and reduced motion.", iconName: "personArmsSpread" },
  { slug: "safety-and-reporting", title: "Safety and reporting", description: "Reporting people and content, blocking, suspensions, appeals and community guidelines.", iconName: "shieldCheck" },
  { slug: "legal-and-data", title: "Legal, privacy and your data", description: "Terms, privacy and cookie policies, consent, downloading and deleting your data.", iconName: "scales" },
  { slug: "troubleshooting", title: "Troubleshooting", description: "Fixes for sign-in, loading, upload, video, notification and checkout problems, and what common error messages mean.", iconName: "wrench" },
  { slug: "contact-support", title: "Contact support", description: "Support tickets, live chat, reply emails and what to expect from our team.", iconName: "headset" },
];

export const helpCategorySlugByTicketCategory: Readonly<Record<TicketCategory, string>> = {
  order: "buying-and-orders",
  payment: "payments-and-wallet",
  account: "account-and-login",
  seller: "selling",
  verification: "checkmarks-and-verification",
  creator: "creators-and-earnings",
  live: "live",
  ads: "ads-and-boosts",
  developer: "troubleshooting",
  sandbox: "troubleshooting",
  safety: "safety-and-reporting",
  other: "getting-started",
};
