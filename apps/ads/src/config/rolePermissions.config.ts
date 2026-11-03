import type { AdAccountRole } from "@/types/adAccount.type";

export type AdsPermission =
  | "account:view"
  | "account:manage"
  | "members:manage"
  | "campaigns:view"
  | "campaigns:manage"
  | "audiences:manage"
  | "reports:view"
  | "reports:manage"
  | "billing:view"
  | "billing:manage"
  | "tools:manage";

const permissionsByRole: Record<AdAccountRole, readonly AdsPermission[]> = {
  admin: ["account:view", "account:manage", "members:manage", "campaigns:view", "campaigns:manage", "audiences:manage", "reports:view", "reports:manage", "billing:view", "billing:manage", "tools:manage"],
  advertiser: ["account:view", "campaigns:view", "campaigns:manage", "audiences:manage", "reports:view", "billing:view", "tools:manage"],
  analyst: ["account:view", "campaigns:view", "reports:view"],
  billing: ["account:view", "campaigns:view", "reports:view", "billing:view", "billing:manage"],
};

export const roleLabels: Record<AdAccountRole, string> = {
  admin: "Admin",
  advertiser: "Advertiser",
  analyst: "Analyst",
  billing: "Billing manager",
};

export const roleDescriptions: Record<AdAccountRole, string> = {
  admin: "Everything, including people, payments and account settings.",
  advertiser: "Create and edit campaigns, audiences, rules and tests. Sees billing.",
  analyst: "Reads campaigns and reports. Cannot change anything.",
  billing: "Tops up, manages cards, spend limits and invoices. Reads reports.",
};

export function doesRoleHavePermission(role: AdAccountRole | null | undefined, permission: AdsPermission): boolean {
  if (!role) return false;
  return permissionsByRole[role].includes(permission);
}

const accountResourcePermissions: readonly { readonly pattern: RegExp; readonly read: AdsPermission; readonly write: AdsPermission }[] = [
  { pattern: /^\/(campaigns|ad-sets|ads|creatives|content-sources|promotable-destinations|bulk-actions)(\/|$)/, read: "campaigns:view", write: "campaigns:manage" },
  { pattern: /^\/audiences(\/|$)/, read: "campaigns:view", write: "audiences:manage" },
  { pattern: /^\/estimates(\/|$)/, read: "campaigns:view", write: "campaigns:view" },
  { pattern: /^\/reports\/scheduled(\/|$)/, read: "reports:view", write: "reports:manage" },
  { pattern: /^\/reports(\/|$)/, read: "reports:view", write: "reports:view" },
  { pattern: /^\/billing(\/|$)/, read: "billing:view", write: "billing:manage" },
  { pattern: /^\/(members|invites)(\/|$)/, read: "account:view", write: "members:manage" },
  { pattern: /^\/(rules|experiments|conversion-events)(\/|$)/, read: "campaigns:view", write: "tools:manage" },
  { pattern: /^\/activity(\/|$)/, read: "account:view", write: "account:manage" },
  { pattern: /^\/entitlements$/, read: "account:view", write: "account:manage" },
  { pattern: /^$/, read: "account:view", write: "account:manage" },
];

export type ApiCallRequirement = { readonly kind: "signed_in" } | { readonly kind: "account"; readonly accountId: string; readonly permission: AdsPermission } | { readonly kind: "denied" };

const signedInOnlyPaths = [/^\/ads\/accounts$/, /^\/ads\/pricing(\/estimate)?$/, /^\/ads\/business-profiles$/, /^\/ads\/invites\/[A-Za-z0-9_-]+(\/accept)?$/, /^\/ads\/locations$/, /^\/ads\/behaviours$/, /^\/topics$/, /^\/ads\/policy$/, /^\/users\/me\/(preferences|consents)$/, /^\/media\/[A-Za-z0-9_-]+$/];

const signedInReadOnlyPaths = [/^\/ads\/verification$/, /^\/wallets\/me$/];

export function findRequirementForApiCall(method: string, apiPath: string): ApiCallRequirement {
  if (signedInReadOnlyPaths.some((pattern) => pattern.test(apiPath))) return method === "GET" || method === "HEAD" ? { kind: "signed_in" } : { kind: "denied" };
  if (signedInOnlyPaths.some((pattern) => pattern.test(apiPath))) return { kind: "signed_in" };
  const accountMatch = /^\/ads\/accounts\/([A-Za-z0-9_-]{1,64})(\/.*)?$/.exec(apiPath);
  if (!accountMatch?.[1]) return { kind: "denied" };
  const remainder = accountMatch[2] ?? "";
  const isReadOnlyCall = method === "GET" || method === "HEAD";
  const resourceRule = accountResourcePermissions.find((rule) => rule.pattern.test(remainder));
  if (!resourceRule) return { kind: "denied" };
  return { kind: "account", accountId: accountMatch[1], permission: isReadOnlyCall ? resourceRule.read : resourceRule.write };
}

const pagePermissions: readonly { readonly pattern: RegExp; readonly permission: AdsPermission }[] = [
  { pattern: /^\/accounts\/[^/]+\/campaigns\/new/, permission: "campaigns:manage" },
  { pattern: /^\/accounts\/[^/]+\/billing/, permission: "billing:view" },
  { pattern: /^\/accounts\/[^/]+\/reports/, permission: "reports:view" },
  { pattern: /^\/accounts\/[^/]+\/tools/, permission: "campaigns:view" },
  { pattern: /^\/accounts\/[^/]+\/settings/, permission: "account:view" },
  { pattern: /^\/accounts\/[^/]+/, permission: "account:view" },
];

export function findPermissionRequiredForPage(pathname: string): AdsPermission | null {
  return pagePermissions.find((rule) => rule.pattern.test(pathname))?.permission ?? null;
}

export function readAccountIdFromPagePath(pathname: string): string | null {
  return /^\/accounts\/([A-Za-z0-9_-]{1,64})(\/|$)/.exec(pathname)?.[1] ?? null;
}
