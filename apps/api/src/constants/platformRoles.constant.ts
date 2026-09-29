import { ADMIN_PERMISSIONS, LEGACY_PLATFORM_PERMISSION_ALIASES, SUPERADMIN_ONLY_PERMISSIONS, type Permission } from "./permissions.constant.js";

export const PlatformRole = { SUPERADMIN: "SUPERADMIN", ADMIN: "ADMIN", SUPPORT: "SUPPORT" } as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const PLATFORM_ROLES: readonly PlatformRole[] = [PlatformRole.SUPERADMIN, PlatformRole.ADMIN, PlatformRole.SUPPORT];

export function listAssignablePlatformPermissions(): readonly Permission[] {
  return ADMIN_PERMISSIONS.filter((permission) => !SUPERADMIN_ONLY_PERMISSIONS.has(permission) && LEGACY_PLATFORM_PERMISSION_ALIASES[permission] === undefined);
}

export function isAssignablePlatformPermission(permission: string): permission is Permission {
  return (listAssignablePlatformPermissions() as readonly string[]).includes(permission);
}

export function listDefaultPermissionsForPlatformRole(role: PlatformRole): readonly Permission[] {
  if (role === PlatformRole.SUPERADMIN) return [...ADMIN_PERMISSIONS];
  if (role === PlatformRole.SUPPORT) return listAssignablePlatformPermissions().filter((permission) => permission === "users:read" || permission.startsWith("support:"));
  return [];
}

export function platformRoleGrantsPermission(role: PlatformRole, grantedPermissions: readonly string[], permission: Permission): boolean {
  if (role === PlatformRole.SUPERADMIN) return true;
  if (SUPERADMIN_ONLY_PERMISSIONS.has(permission)) return false;
  const aliasTarget = LEGACY_PLATFORM_PERMISSION_ALIASES[permission];
  return grantedPermissions.includes(permission) || (aliasTarget !== undefined && grantedPermissions.includes(aliasTarget));
}

export function listEffectivePlatformPermissions(role: PlatformRole, grantedPermissions: readonly string[]): readonly Permission[] {
  return ADMIN_PERMISSIONS.filter((permission) => platformRoleGrantsPermission(role, grantedPermissions, permission));
}
