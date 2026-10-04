import type { AdminPermission } from "@/constants/adminPermissions.constant";

export type ApiAccessRequirement = { readonly kind: "anyOf"; readonly permissions: readonly AdminPermission[] } | { readonly kind: "superadmin" } | { readonly kind: "anyAdmin" };

interface ApiAreaRule {
  readonly prefix: string;
  readonly requirement: ApiAccessRequirement;
}

const anyOf = (...permissions: AdminPermission[]): ApiAccessRequirement => ({ kind: "anyOf", permissions });

const apiAreaRules: readonly ApiAreaRule[] = [
  { prefix: "/admin/account", requirement: { kind: "anyAdmin" } },
  { prefix: "/admin/consents", requirement: { kind: "anyAdmin" } },
  { prefix: "/admin/users/me/preferences", requirement: { kind: "anyAdmin" } },
  { prefix: "/admin/admins", requirement: { kind: "superadmin" } },
  { prefix: "/admin/metrics", requirement: anyOf("metrics:read") },
  { prefix: "/admin/users", requirement: anyOf("users:read", "support:tickets", "verification:review", "moderation:reports") },
  { prefix: "/admin/usernames", requirement: anyOf("usernames:manage", "reserved-usernames:manage") },
  { prefix: "/admin/reserved-usernames", requirement: anyOf("reserved-usernames:manage") },
  { prefix: "/admin/verifications", requirement: anyOf("verification:review", "verification:revoke") },
  { prefix: "/admin/verification-cases", requirement: anyOf("verification:review") },
  { prefix: "/admin/applications/sellers", requirement: anyOf("applications:sellers") },
  { prefix: "/admin/applications/creators", requirement: anyOf("applications:creators") },
  { prefix: "/admin/brands", requirement: anyOf("brands:review", "brands:revoke", "ip-claims:review") },
  { prefix: "/admin/ip-claims", requirement: anyOf("ip-claims:review") },
  { prefix: "/admin/reports", requirement: anyOf("moderation:reports") },
  { prefix: "/admin/trending/moderation", requirement: anyOf("content:review", "moderation:reports") },
  { prefix: "/admin/chat-reports", requirement: anyOf("chat-reports:review", "chat-reports:legal") },
  { prefix: "/admin/appeals", requirement: anyOf("moderation:appeals") },
  { prefix: "/admin/security", requirement: anyOf("security:cases") },
  { prefix: "/admin/copyright-claims", requirement: anyOf("copyright:review") },
  { prefix: "/admin/orders", requirement: anyOf("orders:read", "disputes:resolve", "refunds:issue", "support:tickets") },
  { prefix: "/admin/escrows", requirement: anyOf("orders:read", "disputes:resolve") },
  { prefix: "/admin/disputes", requirement: anyOf("disputes:resolve") },
  { prefix: "/admin/refunds", requirement: anyOf("refunds:issue") },
  { prefix: "/admin/payouts", requirement: anyOf("payouts:approve") },
  { prefix: "/admin/coins", requirement: anyOf("coins:review") },
  { prefix: "/admin/coins/price-table", requirement: anyOf("config:read", "config:plans", "config:revenue") },
  { prefix: "/admin/subscriptions/price-table", requirement: anyOf("config:read", "config:plans", "config:revenue") },
  { prefix: "/admin/ledger", requirement: anyOf("ledger:read") },
  { prefix: "/admin/ads", requirement: anyOf("ads:review", "advertisers:manage") },
  { prefix: "/admin/advertisers", requirement: anyOf("advertisers:manage", "ads:review") },
  { prefix: "/admin/ad-policies", requirement: anyOf("advertisers:manage", "ads:review") },
  { prefix: "/admin/catalog", requirement: anyOf("catalog:manage") },
  { prefix: "/admin/config", requirement: anyOf("config:read", "config:plans", "config:revenue", "config:rules") },
  { prefix: "/admin/flags", requirement: anyOf("flags:manage") },
  { prefix: "/admin/experiments", requirement: anyOf("flags:manage") },
  { prefix: "/admin/automation", requirement: anyOf("automation:manage") },
  { prefix: "/admin/notification-templates", requirement: anyOf("templates:manage") },
  { prefix: "/admin/email-templates", requirement: anyOf("support:email", "legal.documents.view", "legal.documents.edit", "legal.notices.send") },
  { prefix: "/admin/support", requirement: anyOf("support:tickets", "support:assign") },
  { prefix: "/admin/help", requirement: anyOf("support:helpContent", "support:tickets", "support:assign") },
  { prefix: "/admin/legal", requirement: anyOf("legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send") },
  { prefix: "/admin/audit", requirement: anyOf("audit:read") },
];

const stepUpProtectedCalls: readonly { readonly method: string; readonly pattern: RegExp }[] = [
  { method: "POST", pattern: /^\/admin\/admins$/ },
  { method: "POST", pattern: /^\/admin\/account\/recovery-codes\/regenerate$/ },
  { method: "PUT", pattern: /^\/admin\/admins\/[^/]+\/permissions$/ },
  { method: "POST", pattern: /^\/admin\/admins\/[^/]+\/(disable|enable|reset-mfa)$/ },
  { method: "POST", pattern: /^\/admin\/users\/[^/]+\/(ban|unban)$/ },
  { method: "POST", pattern: /^\/admin\/users\/[^/]+\/username\/(withhold|reclaim)$/ },
  { method: "POST", pattern: /^\/admin\/verifications\/[^/]+\/(revoke|suspend)$/ },
  { method: "POST", pattern: /^\/admin\/verification-cases\/[^/]+\/(approve|reject)$/ },
  { method: "POST", pattern: /^\/admin\/disputes\/[^/]+\/resolve$/ },
  { method: "POST", pattern: /^\/admin\/brands\/[^/]+\/official-status\/revoke$/ },
  { method: "POST", pattern: /^\/admin\/ip-claims\/[^/]+\/uphold$/ },
  { method: "POST", pattern: /^\/admin\/refunds$/ },
  { method: "POST", pattern: /^\/admin\/legal\/versions\/[^/]+\/publish$/ },
  { method: "POST", pattern: /^\/admin\/legal\/notices$/ },
  { method: "POST", pattern: /^\/admin\/payouts\/[^/]+\/approve$/ },
  { method: "POST", pattern: /^\/admin\/coins\/[^/]+\/reverse$/ },
  { method: "PUT", pattern: /^\/admin\/config\/.+$/ },
  { method: "PUT", pattern: /^\/admin\/(subscriptions|coins)\/price-table\/.+$/ },
  { method: "POST", pattern: /^\/admin\/config\/.+$/ },
  { method: "PUT", pattern: /^\/admin\/(flags|experiments)\/.+$/ },
  { method: "POST", pattern: /^\/admin\/(flags|experiments)(\/.+)?$/ },
  { method: "PUT", pattern: /^\/admin\/automation\/.+$/ },
  { method: "POST", pattern: /^\/admin\/automation(\/.+)?$/ },
  { method: "DELETE", pattern: /^\/admin\/automation\/.+$/ },
  { method: "PUT", pattern: /^\/admin\/notification-templates\/.+$/ },
  { method: "POST", pattern: /^\/admin\/notification-templates\/.+$/ },
];

export function findApiAccessRequirement(apiPath: string): ApiAccessRequirement | null {
  const rule = apiAreaRules
    .filter((candidate) => apiPath === candidate.prefix || apiPath.startsWith(`${candidate.prefix}/`))
    .sort((first, second) => second.prefix.length - first.prefix.length)[0];
  return rule?.requirement ?? null;
}

export function doesApiCallRequireStepUp(method: string, apiPath: string): boolean {
  return stepUpProtectedCalls.some((call) => call.method === method && call.pattern.test(apiPath));
}
