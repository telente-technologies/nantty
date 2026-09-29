import { ADMIN_PERMISSIONS, SUPERADMIN_ONLY_PERMISSIONS, type Permission } from "./permissions.constant.js";

export const PlatformRole = { SUPERADMIN: "superadmin", ADMIN: "admin", SUPPORT: "support" } as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const PLATFORM_ROLES: readonly PlatformRole[] = [PlatformRole.SUPERADMIN, PlatformRole.ADMIN, PlatformRole.SUPPORT];

export function listAssignablePlatformPermissions(): readonly Permission[] {
  return ADMIN_PERMISSIONS.filter((permission) => !SUPERADMIN_ONLY_PERMISSIONS.has(permission));
}

export function listDefaultPermissionsForPlatformRole(role: PlatformRole): readonly Permission[] {
  if (role === PlatformRole.SUPERADMIN) return [...ADMIN_PERMISSIONS];
  if (role === PlatformRole.SUPPORT) {
    return listAssignablePlatformPermissions().filter((permission) => permission === "users:read" || permission.startsWith("support:"));
  }
  return [];
}

export function platformRoleGrantsPermission(role: PlatformRole, grantedPermissions: readonly string[], permission: Permission): boolean {
  if (role === PlatformRole.SUPERADMIN) return true;
  if (SUPERADMIN_ONLY_PERMISSIONS.has(permission)) return false;
  return grantedPermissions.includes(permission);
}
