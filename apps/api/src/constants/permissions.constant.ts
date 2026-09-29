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
  "reports:create",
  "support:use",
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
  "monetization:manage",
  "admins:manage",
  "users:read",
  "usernames:manage",
  "moderation:review",
  "moderation:appeals",
  "copyright:review",
  "payouts:approve",
  "ads:review",
  "support:manage",
  "automation:manage",
  "metrics:read",
  "users:read-pii",
  "users:moderate",
  "users:ban",
  "reserved-usernames:manage",
  "verification:review",
  "verification:documents",
  "verification:revoke",
  "applications:sellers",
  "applications:creators",
  "brands:review",
  "brands:revoke",
  "ip-claims:review",
  "moderation:reports",
  "orders:read",
  "refunds:issue",
  "coins:review",
  "ledger:read",
  "advertisers:manage",
  "catalog:manage",
  "config:read",
  "config:plans",
  "config:revenue",
  "config:rules",
  "flags:manage",
  "templates:manage",
  "support:tickets",
  "support:assign",
  "audit:export",
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

export const LEGACY_PLATFORM_PERMISSION_ALIASES: Readonly<Partial<Record<Permission, Permission>>> = {
  "seller-applications:review": "applications:sellers",
  "stores:suspend": "users:moderate",
  "categories:manage": "catalog:manage",
  "topics:manage": "catalog:manage",
  "withdrawals:process": "payouts:approve",
  "waitlist:read": "metrics:read",
  "exchange-rates:manage": "config:revenue",
  "verifications:review": "verification:review",
  "subscriptions:manage": "verification:revoke",
  "creators:review": "applications:creators",
  "media:read-private": "verification:documents",
  "monetization:manage": "config:revenue",
  "moderation:review": "moderation:reports",
  "support:manage": "support:assign",
};

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
