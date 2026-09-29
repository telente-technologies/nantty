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
  "wallet:use",
  "verification:apply",
  "subscriptions:use",
  "sounds:use",
  "copyright:claim",
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
  "verifications:review",
  "subscriptions:manage",
  "creators:review",
  "media:read-private",
  "admins:manage",
  "users:read",
  "users:manage",
  "usernames:manage",
  "verifications:review-blue",
  "verifications:review-gold",
  "verifications:review-black",
  "moderation:review",
  "moderation:appeals",
  "copyright:review",
  "refunds:approve",
  "payouts:approve",
  "ads:review",
  "plans:manage",
  "perks:manage",
  "fees:manage",
  "feature-flags:manage",
  "analytics:read",
] as const;

export type Permission =
  | (typeof BUYER_PERMISSIONS)[number]
  | (typeof SELLER_PERMISSIONS)[number]
  | (typeof ADMIN_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  [Role.BUYER]: new Set<Permission>(BUYER_PERMISSIONS),
  [Role.SELLER]: new Set<Permission>([...BUYER_PERMISSIONS, ...SELLER_PERMISSIONS]),
  [Role.ADMIN]: new Set<Permission>([...BUYER_PERMISSIONS, ...SELLER_PERMISSIONS]),
};

export const SUPERADMIN_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>(["admins:manage"]);

export const PLATFORM_PERMISSION_ROLE_PREFIX = "platform-permission:";

export function isPlatformPermission(permission: string): permission is Permission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(permission);
}

export function describePlatformPermissionAsRole(permission: Permission): string {
  return `${PLATFORM_PERMISSION_ROLE_PREFIX}${permission}`;
}

export function rolesGrantPermission(roles: readonly string[], permission: Permission): boolean {
  if (isPlatformPermission(permission)) return roles.includes(describePlatformPermissionAsRole(permission));
  return roles.some((role) => ROLE_PERMISSIONS[role as Role]?.has(permission) === true);
}
