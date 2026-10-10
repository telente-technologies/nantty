import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { ZudoIconName } from "@/constants/zudoIconNames.constant";

export type PageRequirement = AdminPermission | "SUPERADMIN" | "ANY_ADMIN";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: ZudoIconName;
  readonly requirement: PageRequirement;
  readonly anyOf?: readonly AdminPermission[];
  readonly goShortcutKey?: string;
}

export interface NavigationGroup {
  readonly title: string;
  readonly items: readonly NavigationItem[];
}

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
      { label: "Accounts", href: "/accounts", icon: "userProfile45", requirement: "verification:grant" },
      { label: "Reserved usernames", href: "/usernames/reserved", icon: "tag24", requirement: "reserved-usernames:manage" },
      { label: "Verification", href: "/verification", icon: "sealCheck20", requirement: "verification:review", goShortcutKey: "v" },
      { label: "Business documents", href: "/verification/business-documents", icon: "sealCheck20", requirement: "verification:review" },
      { label: "Black applications", href: "/verification/black", icon: "shield24", requirement: "verification:review" },
      { label: "Seller applications", href: "/applications/sellers", icon: "buildingStore20", requirement: "applications:sellers" },
      { label: "Creator applications", href: "/applications/creators", icon: "videoCamera24", requirement: "applications:creators" },
      { label: "Brands", href: "/brands", icon: "buildingStore20", requirement: "brands:review", goShortcutKey: "b" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { label: "Reports", href: "/moderation/reports", icon: "warning20", requirement: "moderation:reports", goShortcutKey: "r" },
      { label: "Live incidents", href: "/moderation/live-incidents", icon: "videoCamera24", requirement: "moderation:reports", goShortcutKey: "i" },
      { label: "Chat reports", href: "/moderation/chat-reports", icon: "chatCircle24", requirement: "chat-reports:review" },
      { label: "Suspensions", href: "/moderation/suspensions", icon: "shield24", requirement: "users:suspend" },
      { label: "Security cases", href: "/moderation/security", icon: "shield24", requirement: "security:cases" },
      { label: "Manipulation flags", href: "/moderation/manipulation", icon: "warning20", requirement: "users:suspend" },
      { label: "Trends & headlines", href: "/moderation/trends", icon: "tag24", requirement: "moderation:reports" },
      { label: "Appeals", href: "/moderation/appeals", icon: "refresh20", requirement: "moderation:appeals" },
      { label: "Copyright", href: "/moderation/copyright", icon: "speakerHigh24", requirement: "copyright:review", goShortcutKey: "c" },
      { label: "Trademark claims", href: "/ip-claims", icon: "tag24", requirement: "ip-claims:review", goShortcutKey: "t" },
      { label: "Ads review", href: "/ads/review", icon: "play24", requirement: "ads:review" },
      { label: "Advertisers", href: "/ads/advertisers", icon: "arrowUpRight24", requirement: "advertisers:manage" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Orders", href: "/commerce/orders", icon: "shoppingCart24", requirement: "orders:read" },
      { label: "Disputes", href: "/commerce/disputes", icon: "chatCircle24", requirement: "disputes:resolve", goShortcutKey: "d" },
      { label: "Refunds", href: "/commerce/refunds", icon: "arrowLeft24", requirement: "refunds:issue" },
      { label: "Withdrawals", href: "/commerce/payouts", icon: "creditCard24", requirement: "payouts:approve", goShortcutKey: "p" },
      { label: "Coins", href: "/commerce/coins", icon: "star16", requirement: "coins:review" },
      { label: "Ledger", href: "/commerce/ledger", icon: "bookmarkSimple24", requirement: "ledger:read" },
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
      { label: "Plans & perks", href: "/config/plans", icon: "viewProducts24", requirement: "config:read" },
      { label: "Regional pricing", href: "/config/pricing", icon: "creditCard24", requirement: "config:read" },
      { label: "Revenue rules", href: "/config/revenue", icon: "creditCard24", requirement: "config:read" },
      { label: "Platform rules", href: "/config/rules", icon: "slidersHorizontal24", requirement: "config:read" },
      { label: "Feed ranking", href: "/config/ranking", icon: "slidersHorizontal24", requirement: "config:read" },
      { label: "Feature flags", href: "/config/flags", icon: "check16", requirement: "flags:manage" },
      { label: "Automation", href: "/config/automation", icon: "refresh20", requirement: "automation:manage" },
      { label: "Notification templates", href: "/config/templates", icon: "bell24", requirement: "templates:manage" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Legal documents", href: "/legal", icon: "textIndent24", requirement: "legal.documents.view" },
      { label: "Policy notices", href: "/legal/notices", icon: "export24", requirement: "legal.documents.view" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Tickets", href: "/support", icon: "headset24", requirement: "support:tickets", goShortcutKey: "s" },
      { label: "Live chat", href: "/support/chat", icon: "chatCircle24", requirement: "support:chat" },
      { label: "Help centre", href: "/support/help", icon: "bookmarkSimple24", requirement: "support:helpContent" },
      { label: "Email", href: "/support/email", icon: "export24", requirement: "support:email" },
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
  { prefix: "/ads/policies", requirement: "advertisers:manage" },
];

export const pageRequirementsByPathPrefix: readonly PageRequirementEntry[] = [
  ...extraPageRequirements,
  ...navigationGroups.flatMap((group) => group.items.map((item): PageRequirementEntry => ({ prefix: item.href, requirement: item.requirement }))),
].sort((first, second) => second.prefix.length - first.prefix.length);

export function findRequirementForPagePath(pathname: string): PageRequirement | null {
  const match = pageRequirementsByPathPrefix.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`));
  return match?.requirement ?? null;
}
