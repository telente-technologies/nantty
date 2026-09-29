import type { StaffRole } from "@/types/sellerAccess.type";

export type SellerPermission =
  | "dashboard:view"
  | "pos:sell"
  | "pos:refund"
  | "pos:approve_discount"
  | "pos:manage_all_shifts"
  | "catalog:view"
  | "products:manage"
  | "inventory:manage"
  | "orders:view"
  | "orders:manage"
  | "customers:view"
  | "customers:manage"
  | "promotions:manage"
  | "staff:manage"
  | "audit:view"
  | "reports:view"
  | "wallet:view"
  | "wallet:withdraw"
  | "settings:view"
  | "settings:manage"
  | "billing:manage"
  | "affiliates:manage"
  | "media:upload";

const permissionsGrantedToEveryRole: SellerPermission[] = ["catalog:view", "settings:view"];

export const permissionsByStaffRole: Record<StaffRole, ReadonlySet<SellerPermission>> = {
  owner: new Set<SellerPermission>([
    ...permissionsGrantedToEveryRole,
    "dashboard:view", "pos:sell", "pos:refund", "pos:approve_discount", "pos:manage_all_shifts", "products:manage",
    "inventory:manage", "orders:view", "orders:manage", "customers:view", "customers:manage", "promotions:manage",
    "staff:manage", "audit:view", "reports:view", "wallet:view", "wallet:withdraw", "settings:manage", "billing:manage",
    "affiliates:manage", "media:upload",
  ]),
  admin: new Set<SellerPermission>([
    ...permissionsGrantedToEveryRole,
    "dashboard:view", "pos:sell", "pos:refund", "pos:approve_discount", "pos:manage_all_shifts", "products:manage",
    "inventory:manage", "orders:view", "orders:manage", "customers:view", "customers:manage", "promotions:manage",
    "staff:manage", "audit:view", "reports:view", "wallet:view", "settings:manage", "affiliates:manage", "media:upload",
  ]),
  manager: new Set<SellerPermission>([
    ...permissionsGrantedToEveryRole,
    "dashboard:view", "pos:sell", "pos:refund", "pos:approve_discount", "pos:manage_all_shifts", "products:manage",
    "inventory:manage", "orders:view", "orders:manage", "customers:view", "customers:manage", "promotions:manage",
    "reports:view", "affiliates:manage", "media:upload",
  ]),
  cashier: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "pos:sell", "customers:view"]),
  inventory: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "products:manage", "inventory:manage", "media:upload"]),
  support: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "orders:view", "orders:manage", "customers:view", "customers:manage"]),
};

export function doesRoleHavePermission(role: StaffRole | null, permission: SellerPermission): boolean {
  if (!role) return false;
  return permissionsByStaffRole[role].has(permission);
}

const pagePermissionRules: { readonly pathPrefix: string; readonly permission: SellerPermission }[] = [
  { pathPrefix: "/dashboard", permission: "dashboard:view" },
  { pathPrefix: "/pos", permission: "pos:sell" },
  { pathPrefix: "/sales", permission: "pos:sell" },
  { pathPrefix: "/products", permission: "products:manage" },
  { pathPrefix: "/inventory", permission: "inventory:manage" },
  { pathPrefix: "/orders", permission: "orders:view" },
  { pathPrefix: "/customers", permission: "customers:manage" },
  { pathPrefix: "/promotions", permission: "promotions:manage" },
  { pathPrefix: "/staff", permission: "staff:manage" },
  { pathPrefix: "/reports", permission: "reports:view" },
  { pathPrefix: "/wallet", permission: "wallet:view" },
  { pathPrefix: "/affiliates", permission: "affiliates:manage" },
  { pathPrefix: "/brand", permission: "settings:view" },
  { pathPrefix: "/settings/billing", permission: "billing:manage" },
  { pathPrefix: "/settings", permission: "settings:view" },
];

export function findPermissionRequiredForPage(pathname: string): SellerPermission | null {
  const matchingRule = pagePermissionRules.find((rule) => pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`));
  return matchingRule?.permission ?? null;
}

export function findFirstPageAllowedForRole(role: StaffRole | null): string {
  if (doesRoleHavePermission(role, "dashboard:view")) return "/dashboard";
  if (doesRoleHavePermission(role, "pos:sell")) return "/pos";
  if (doesRoleHavePermission(role, "inventory:manage")) return "/products";
  if (doesRoleHavePermission(role, "orders:view")) return "/orders";
  return "/settings";
}

type HttpMethodPattern = "GET" | "WRITE" | "ANY" | "POST" | "PATCH" | "PUT" | "DELETE";

interface ApiPermissionRule {
  readonly method: HttpMethodPattern;
  readonly pathPattern: RegExp;
  readonly permission: SellerPermission | "signed_in";
}

const apiPermissionRules: ApiPermissionRule[] = [
  { method: "ANY", pathPattern: /^\/seller\/access$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/subscription(\/plans)?$/, permission: "signed_in" },
  { method: "WRITE", pathPattern: /^\/seller\/subscription\//, permission: "billing:manage" },
  { method: "GET", pathPattern: /^\/seller\/verification$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/dashboard/, permission: "dashboard:view" },
  { method: "ANY", pathPattern: /^\/seller\/staff\/pin-sessions/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/staff\/pin-roster$/, permission: "signed_in" },
  { method: "POST", pathPattern: /^\/seller\/pos\/discount-approvals$/, permission: "pos:sell" },
  { method: "POST", pathPattern: /^\/seller\/pos\/sales\/[^/]+\/refunds$/, permission: "pos:refund" },
  { method: "GET", pathPattern: /^\/seller\/pos\/registers/, permission: "catalog:view" },
  { method: "WRITE", pathPattern: /^\/seller\/pos\/registers/, permission: "settings:manage" },
  { method: "ANY", pathPattern: /^\/seller\/pos\//, permission: "pos:sell" },
  { method: "GET", pathPattern: /^\/seller\/(products|categories)/, permission: "catalog:view" },
  { method: "ANY", pathPattern: /^\/seller\/(products|categories)/, permission: "products:manage" },
  { method: "ANY", pathPattern: /^\/seller\/inventory\//, permission: "inventory:manage" },
  { method: "GET", pathPattern: /^\/seller\/(orders|returns|disputes)/, permission: "orders:view" },
  { method: "ANY", pathPattern: /^\/seller\/(orders|returns|disputes)/, permission: "orders:manage" },
  { method: "GET", pathPattern: /^\/seller\/customers$/, permission: "customers:view" },
  { method: "POST", pathPattern: /^\/seller\/customers$/, permission: "customers:view" },
  { method: "ANY", pathPattern: /^\/seller\/customers/, permission: "customers:manage" },
  { method: "POST", pathPattern: /^\/seller\/promotions\/validate-code$/, permission: "pos:sell" },
  { method: "ANY", pathPattern: /^\/seller\/promotions/, permission: "promotions:manage" },
  { method: "GET", pathPattern: /^\/seller\/audit-log/, permission: "audit:view" },
  { method: "ANY", pathPattern: /^\/seller\/staff/, permission: "staff:manage" },
  { method: "ANY", pathPattern: /^\/seller\/reports\//, permission: "reports:view" },
  { method: "WRITE", pathPattern: /^\/seller\/wallet\/(payouts|payout-accounts)/, permission: "wallet:withdraw" },
  { method: "ANY", pathPattern: /^\/seller\/wallet\//, permission: "wallet:view" },
  { method: "GET", pathPattern: /^\/seller\/(settings|locations)/, permission: "settings:view" },
  { method: "ANY", pathPattern: /^\/seller\/(settings|locations)/, permission: "settings:manage" },
  { method: "ANY", pathPattern: /^\/seller\/affiliates\//, permission: "affiliates:manage" },
  { method: "GET", pathPattern: /^\/seller\/stores\/mine$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/brands(\/|$)/, permission: "settings:view" },
  { method: "WRITE", pathPattern: /^\/seller\/brands\//, permission: "settings:manage" },
  { method: "ANY", pathPattern: /^\/media\//, permission: "media:upload" },
];

function doesMethodMatchPattern(method: string, pattern: HttpMethodPattern): boolean {
  if (pattern === "ANY") return true;
  if (pattern === "GET") return method === "GET" || method === "HEAD";
  if (pattern === "WRITE") return method !== "GET" && method !== "HEAD";
  return method === pattern;
}

export function findPermissionRequiredForApiCall(method: string, apiPath: string): SellerPermission | "signed_in" | null {
  const matchingRule = apiPermissionRules.find(
    (rule) => doesMethodMatchPattern(method, rule.method) && rule.pathPattern.test(apiPath),
  );
  return matchingRule?.permission ?? null;
}
