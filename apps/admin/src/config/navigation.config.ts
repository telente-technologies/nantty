import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { ZudoIconName } from "@/constants/zudoIconNames.constant";

export type PageRequirement = AdminPermission | readonly AdminPermission[] | "SUPERADMIN" | "ANY_ADMIN";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: ZudoIconName;
  readonly requirement: PageRequirement;
  readonly goShortcutKey?: string;
}

export interface NavigationGroup {
  readonly title: string;
  readonly items: readonly NavigationItem[];
}

const configReaders: readonly AdminPermission[] = ["config:read", "config:plans", "config:revenue", "config:rules"];
const legalReaders: readonly AdminPermission[] = ["legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send"];

export const navigationGroups: readonly NavigationGroup[] = [
  {
    title: "Platform",
    items: [
      { label: "Overview", href: "/overview", icon: "speedometer24", requirement: "metrics:read", goShortcutKey: "o" },
      { label: "Audit log", href: "/audit", icon: "textIndent24", requirement: "audit:read", goShortcutKey: "l" },
      { label: "Admins & roles", href: "/admins", icon: "shield24", requirement: "staff:manage", goShortcutKey: "a" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Users", href: "/users", icon: "userCircle24", requirement: "users:read", goShortcutKey: "u" },
      { label: "Accounts", href: "/accounts", icon: "userProfile45", requirement: ["verification:grant", "verification:revoke"] },
      { label: "Reserved usernames", href: "/usernames/reserved", icon: "tag24", requirement: "reserved-usernames:manage" },
      { label: "Verification", href: "/verification", icon: "sealCheck20", requirement: ["verification:review", "verification:revoke"], goShortcutKey: "v" },
      { label: "Business documents", href: "/verification/business-documents", icon: "sealCheck20", requirement: "verification:review" },
      { label: "Black applications", href: "/verification/black", icon: "shield24", requirement: ["verification:review", "verification:revoke"] },
      { label: "Seller applications", href: "/applications/sellers", icon: "buildingStore20", requirement: "applications:sellers" },
      { label: "Creator applications", href: "/applications/creators", icon: "videoCamera24", requirement: "applications:creators" },
      { label: "Brands", href: "/brands", icon: "buildingStore20", requirement: ["brands:review", "brands:revoke"], goShortcutKey: "b" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { label: "Reports", href: "/moderation/reports", icon: "warning20", requirement: "moderation:reports", goShortcutKey: "r" },
      { label: "Live incidents", href: "/moderation/live-incidents", icon: "videoCamera24", requirement: "moderation:reports", goShortcutKey: "i" },
      { label: "Chat reports", href: "/moderation/chat-reports", icon: "chatCircle24", requirement: ["chat-reports:review", "chat-reports:legal"] },
      { label: "Suspensions", href: "/moderation/suspensions", icon: "shield24", requirement: ["users:suspend", "users:moderate"] },
      { label: "Security cases", href: "/moderation/security", icon: "shield24", requirement: "security:cases" },
      { label: "Manipulation flags", href: "/moderation/manipulation", icon: "warning20", requirement: ["users:suspend", "users:moderate"] },
      { label: "Trends & headlines", href: "/moderation/trends", icon: "tag24", requirement: ["moderation:reports", "content:review"] },
      { label: "Appeals", href: "/moderation/appeals", icon: "refresh20", requirement: "moderation:appeals" },
      { label: "Copyright", href: "/moderation/copyright", icon: "speakerHigh24", requirement: "copyright:review", goShortcutKey: "c" },
      { label: "Trademark claims", href: "/ip-claims", icon: "tag24", requirement: "ip-claims:review", goShortcutKey: "t" },
      { label: "Ads review", href: "/ads/review", icon: "play24", requirement: "ads:review" },
      { label: "Advertisers", href: "/ads/advertisers", icon: "arrowUpRight24", requirement: ["advertisers:manage", "ads:review"] },
      { label: "Ad credit", href: "/ads/credit", icon: "creditCard24", requirement: ["advertisers:manage", "ledger:read"] },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Orders", href: "/commerce/orders", icon: "shoppingCart24", requirement: ["orders:read", "disputes:resolve", "refunds:issue", "support:tickets"] },
      { label: "Disputes", href: "/commerce/disputes", icon: "chatCircle24", requirement: "disputes:resolve", goShortcutKey: "d" },
      { label: "Undelivered orders", href: "/commerce/undelivered", icon: "warning20", requirement: "disputes:resolve" },
      { label: "Refunds", href: "/commerce/refunds", icon: "arrowLeft24", requirement: "refunds:issue" },
      { label: "Withdrawals", href: "/commerce/payouts", icon: "creditCard24", requirement: "payouts:approve", goShortcutKey: "p" },
      { label: "Coins", href: "/commerce/coins", icon: "star16", requirement: "coins:review" },
      { label: "Ledger", href: "/commerce/ledger", icon: "bookmarkSimple24", requirement: "ledger:read" },
      { label: "Payment webhooks", href: "/commerce/webhooks", icon: "arrowUpRight24", requirement: "payments:webhooks" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Categories & topics", href: "/catalog/categories", icon: "squaresFour24", requirement: "catalog:manage" },
      { label: "Mart home", href: "/catalog/featured", icon: "image24", requirement: "catalog:manage" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Plans & perks", href: "/config/plans", icon: "viewProducts24", requirement: configReaders },
      { label: "Regional pricing", href: "/config/pricing", icon: "creditCard24", requirement: configReaders },
      { label: "Subscription offers", href: "/config/offers", icon: "tag24", requirement: configReaders },
      { label: "Revenue rules", href: "/config/revenue", icon: "creditCard24", requirement: configReaders },
      { label: "Platform rules", href: "/config/rules", icon: "slidersHorizontal24", requirement: configReaders },
      { label: "Feed ranking", href: "/config/ranking", icon: "slidersHorizontal24", requirement: configReaders },
            { label: "Automation", href: "/config/automation", icon: "refresh20", requirement: "automation:manage" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Legal documents", href: "/legal", icon: "textIndent24", requirement: legalReaders },
      { label: "Policy notices", href: "/legal/notices", icon: "export24", requirement: legalReaders },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Tickets", href: "/support", icon: "headset24", requirement: ["support:tickets", "support:assign"], goShortcutKey: "s" },
      { label: "Live chat", href: "/support/chat", icon: "chatCircle24", requirement: "support:chat" },
      { label: "Help centre", href: "/support/help", icon: "bookmarkSimple24", requirement: "support:helpContent" },
      { label: "Email", href: "/support/email", icon: "export24", requirement: ["support:email", "marketing:email"] },
      { label: "Email templates", href: "/support/email-templates", icon: "bell24", requirement: "support:email" },
    ],
  },
];

interface PageRequirementEntry {
  readonly prefix: string;
  readonly requirement: PageRequirement;
}

const extraPageRequirements: readonly PageRequirementEntry[] = [
  { prefix: "/account", requirement: "ANY_ADMIN" },
  { prefix: "/catalog/topics", requirement: "catalog:manage" },
  { prefix: "/ads/policies", requirement: ["advertisers:manage", "ads:review"] },
];

export const pageRequirementsByPathPrefix: readonly PageRequirementEntry[] = [
  ...extraPageRequirements,
  ...navigationGroups.flatMap((group) => group.items.map((item): PageRequirementEntry => ({ prefix: item.href, requirement: item.requirement }))),
].sort((first, second) => second.prefix.length - first.prefix.length);

export function findRequirementForPagePath(pathname: string): PageRequirement | null {
  const match = pageRequirementsByPathPrefix.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`));
  return match?.requirement ?? null;
}
