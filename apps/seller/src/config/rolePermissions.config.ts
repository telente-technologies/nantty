import type { SellerAccess, StaffRole } from "@/types/sellerAccess.type";

export const sellerPermissions = [
  "dashboard:view", "catalog:view", "products:manage", "inventory:manage", "orders:view", "orders:manage",
  "delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage", "analytics:view",
  "promotions:manage", "ads:view", "affiliates:manage", "storefront:manage", "wallet:view", "wallet:withdraw",
  "reports:view", "staff:manage", "audit:view", "settings:view", "settings:manage", "billing:manage",
  "developer:manage", "media:upload",
] as const;

export type SellerPermission = (typeof sellerPermissions)[number];

export const sellerPermissionLabels: Record<SellerPermission, string> = {
  "dashboard:view": "See the overview",
  "catalog:view": "Browse products",
  "products:manage": "Add and edit products",
  "inventory:manage": "Manage stock",
  "orders:view": "See orders",
  "orders:manage": "Accept, update and refund orders",
  "delivery:manage": "Manage delivery",
  "customers:view": "See customers",
  "customers:manage": "Edit customers and notes",
  "messages:manage": "Reply to customer messages",
  "reviews:manage": "Respond to reviews",
  "analytics:view": "See sales analytics",
  "promotions:manage": "Run marketing and discounts",
  "ads:view": "See ad results",
  "affiliates:manage": "Manage affiliates and creators",
  "storefront:manage": "Edit the storefront",
  "wallet:view": "See balances and transactions",
  "wallet:withdraw": "Withdraw money",
  "reports:view": "Download reports",
  "staff:manage": "Manage the team",
  "audit:view": "See the activity log",
  "settings:view": "See settings",
  "settings:manage": "Change settings",
  "billing:manage": "Change the plan",
  "developer:manage": "API keys and webhooks",
  "media:upload": "Upload photos and videos",
};

const permissionsGrantedToEveryRole: SellerPermission[] = ["dashboard:view", "catalog:view", "settings:view"];
const ownerOnlyPermissions: SellerPermission[] = ["billing:manage", "wallet:withdraw", "developer:manage"];

export const permissionsByStaffRole: Record<StaffRole, ReadonlySet<SellerPermission>> = {
  owner: new Set<SellerPermission>(sellerPermissions),
  manager: new Set<SellerPermission>(sellerPermissions.filter((permission) => !ownerOnlyPermissions.includes(permission))),
  inventory: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "products:manage", "inventory:manage", "media:upload"]),
  sales: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "orders:view", "orders:manage", "delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage"]),
  accountant: new Set<SellerPermission>([...permissionsGrantedToEveryRole, "orders:view", "wallet:view", "reports:view", "analytics:view", "ads:view", "audit:view"]),
};

export function doesRoleHavePermission(role: StaffRole | null, permission: SellerPermission): boolean {
  if (!role) return false;
  return permissionsByStaffRole[role].has(permission);
}

export function doesAccessGrantPermission(access: Pick<SellerAccess, "role" | "permissions"> | null | undefined, permission: SellerPermission): boolean {
  if (!access?.role) return false;
  if (access.role === "owner") return true;
  if (access.permissions) return access.permissions.includes(permission);
  return doesRoleHavePermission(access.role, permission);
}

const pagePermissionRules: { readonly pathPrefix: string; readonly permission: SellerPermission }[] = [
  { pathPrefix: "/dashboard", permission: "dashboard:view" },
  { pathPrefix: "/products", permission: "products:manage" },
  { pathPrefix: "/inventory", permission: "inventory:manage" },
  { pathPrefix: "/orders", permission: "orders:view" },
  { pathPrefix: "/delivery", permission: "delivery:manage" },
  { pathPrefix: "/customers", permission: "customers:view" },
  { pathPrefix: "/messages", permission: "messages:manage" },
  { pathPrefix: "/reviews", permission: "reviews:manage" },
  { pathPrefix: "/analytics", permission: "analytics:view" },
  { pathPrefix: "/marketing", permission: "promotions:manage" },
  { pathPrefix: "/promotions", permission: "promotions:manage" },
  { pathPrefix: "/ads", permission: "ads:view" },
  { pathPrefix: "/affiliates", permission: "affiliates:manage" },
  { pathPrefix: "/storefront", permission: "storefront:manage" },
  { pathPrefix: "/wallet", permission: "wallet:view" },
  { pathPrefix: "/reports", permission: "reports:view" },
  { pathPrefix: "/staff", permission: "staff:manage" },
  { pathPrefix: "/brand", permission: "settings:view" },
  { pathPrefix: "/settings/billing", permission: "billing:manage" },
  { pathPrefix: "/settings/business-documents", permission: "billing:manage" },
  { pathPrefix: "/settings/developers", permission: "developer:manage" },
  { pathPrefix: "/settings", permission: "settings:view" },
];

export function findPermissionRequiredForPage(pathname: string): SellerPermission | null {
  const matchingRule = pagePermissionRules.find((rule) => pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`));
  return matchingRule?.permission ?? null;
}

export function findFirstPageAllowedForAccess(access: Pick<SellerAccess, "role" | "permissions"> | null): string {
  if (doesAccessGrantPermission(access, "dashboard:view")) return "/dashboard";
  if (doesAccessGrantPermission(access, "orders:view")) return "/orders";
  if (doesAccessGrantPermission(access, "products:manage")) return "/products";
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
  { method: "GET", pathPattern: /^\/seller\/subscription\/trial$/, permission: "billing:manage" },
  { method: "WRITE", pathPattern: /^\/seller\/subscription\//, permission: "billing:manage" },
  { method: "GET", pathPattern: /^\/seller\/verification$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/zudomart-users$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/notifications/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/dashboard/, permission: "dashboard:view" },
  { method: "GET", pathPattern: /^\/seller\/(products|categories|brands-catalog|attributes)/, permission: "catalog:view" },
  { method: "ANY", pathPattern: /^\/seller\/(products|categories|brands-catalog|attributes)/, permission: "products:manage" },
  { method: "ANY", pathPattern: /^\/seller\/(inventory|suppliers)\//, permission: "inventory:manage" },
  { method: "ANY", pathPattern: /^\/seller\/suppliers$/, permission: "inventory:manage" },
  { method: "GET", pathPattern: /^\/seller\/(orders|returns|disputes)/, permission: "orders:view" },
  { method: "ANY", pathPattern: /^\/seller\/(orders|returns|disputes)/, permission: "orders:manage" },
  { method: "ANY", pathPattern: /^\/seller\/delivery/, permission: "delivery:manage" },
  { method: "ANY", pathPattern: /^\/seller\/shipping/, permission: "delivery:manage" },
  { method: "PUT", pathPattern: /^\/users\/me\/consents$/, permission: "signed_in" },
  { method: "PATCH", pathPattern: /^\/users\/me\/preferences$/, permission: "signed_in" },
  { method: "POST", pathPattern: /^\/auth\/(step-up|otp\/send|otp\/verify)$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/customers/, permission: "customers:view" },
  { method: "ANY", pathPattern: /^\/seller\/customers/, permission: "customers:manage" },
  { method: "ANY", pathPattern: /^\/seller\/conversations/, permission: "messages:manage" },
  { method: "ANY", pathPattern: /^\/chat\/keys\//, permission: "messages:manage" },
  { method: "GET", pathPattern: /^\/chat\/content$/, permission: "messages:manage" },
  { method: "ANY", pathPattern: /^\/seller\/reviews/, permission: "reviews:manage" },
  { method: "GET", pathPattern: /^\/seller\/analytics/, permission: "analytics:view" },
  { method: "ANY", pathPattern: /^\/seller\/(promotions|marketing)/, permission: "promotions:manage" },
  { method: "GET", pathPattern: /^\/seller\/ads/, permission: "ads:view" },
  { method: "ANY", pathPattern: /^\/seller\/storefront/, permission: "storefront:manage" },
  { method: "GET", pathPattern: /^\/seller\/audit-log/, permission: "audit:view" },
  { method: "ANY", pathPattern: /^\/seller\/staff/, permission: "staff:manage" },
  { method: "ANY", pathPattern: /^\/seller\/reports\//, permission: "reports:view" },
  { method: "WRITE", pathPattern: /^\/seller\/wallet\/(payouts|payout-accounts)/, permission: "wallet:withdraw" },
  { method: "ANY", pathPattern: /^\/seller\/(wallet|finance)\//, permission: "wallet:view" },
  { method: "ANY", pathPattern: /^\/seller\/developers/, permission: "developer:manage" },
  { method: "ANY", pathPattern: /^\/seller\/security/, permission: "signed_in" },
  { method: "ANY", pathPattern: /^\/seller\/business-documents(\/|$)/, permission: "billing:manage" },
  { method: "GET", pathPattern: /^\/seller\/(settings|locations|integrations)/, permission: "settings:view" },
  { method: "ANY", pathPattern: /^\/seller\/(settings|locations|integrations)/, permission: "settings:manage" },
  { method: "ANY", pathPattern: /^\/seller\/affiliates\//, permission: "affiliates:manage" },
  { method: "GET", pathPattern: /^\/seller\/stores\/mine$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/account\/status$/, permission: "signed_in" },
  { method: "GET", pathPattern: /^\/seller\/brands(\/|$)/, permission: "settings:view" },
  { method: "WRITE", pathPattern: /^\/seller\/brands\//, permission: "settings:manage" },
  { method: "ANY", pathPattern: /^\/media\//, permission: "media:upload" },
  { method: "ANY", pathPattern: /^\/payments\/(payout-onboarding\/me|payout-fees)/, permission: "wallet:withdraw" },
  { method: "GET", pathPattern: /^\/wallets\/me$/, permission: "wallet:view" },
  { method: "GET", pathPattern: /^\/payments\/(wallet|verification)\/me$/, permission: "wallet:withdraw" },
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

const chatMediaApiPathPattern = /^\/media\/(uploads(\/[A-Za-z0-9._~:@%-]+)*|[A-Za-z0-9._~:@%-]+\/encrypted-blob)$/;

export function grantsChatMediaAccess(access: SellerAccess, apiPath: string): boolean {
  return chatMediaApiPathPattern.test(apiPath) && doesAccessGrantPermission(access, "messages:manage");
}
