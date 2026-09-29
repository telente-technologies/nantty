import { Role } from "./roles.constant.js";

export const BUYER_PERMISSIONS = [
  "profile:manage",
  "feed:read",
  "social:write",
  "cart:manage",
  "orders:place",
  "orders:read-own",
  "disputes:open",
  "reviews:write",
  "messages:use",
  "notifications:manage",
  "media:upload",
  "seller:apply",
] as const;

export const SELLER_PERMISSIONS = [
  "stores:manage",
  "products:manage",
  "orders:fulfil",
  "wallet:manage",
  "reviews:reply",
] as const;

export const ADMIN_PERMISSIONS = [
  "seller-applications:review",
  "stores:suspend",
  "categories:manage",
  "topics:manage",
  "disputes:resolve",
  "withdrawals:process",
  "audit:read",
  "waitlist:read",
  "exchange-rates:manage",
] as const;

export type Permission =
  | (typeof BUYER_PERMISSIONS)[number]
  | (typeof SELLER_PERMISSIONS)[number]
  | (typeof ADMIN_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  [Role.BUYER]: new Set<Permission>(BUYER_PERMISSIONS),
  [Role.SELLER]: new Set<Permission>([...BUYER_PERMISSIONS, ...SELLER_PERMISSIONS]),
  [Role.ADMIN]: new Set<Permission>([...BUYER_PERMISSIONS, ...SELLER_PERMISSIONS, ...ADMIN_PERMISSIONS]),
};

export function rolesGrantPermission(roles: readonly string[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role as Role]?.has(permission) === true);
}
