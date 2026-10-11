import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { PageRequirement } from "@/config/navigation.config";
import type { SignedInAdmin } from "@/types/admin.type";

export function isSuperadmin(admin: Pick<SignedInAdmin, "role">): boolean {
  return admin.role === "SUPERADMIN";
}

export function doesAdminHavePermission(admin: Pick<SignedInAdmin, "role" | "permissions">, permission: AdminPermission): boolean {
  return isSuperadmin(admin) || admin.permissions.includes(permission);
}

export function doesAdminHaveAnyPermission(admin: Pick<SignedInAdmin, "role" | "permissions">, permissions: readonly AdminPermission[]): boolean {
  return permissions.some((permission) => doesAdminHavePermission(admin, permission));
}

export function doesAdminMeetPageRequirement(admin: Pick<SignedInAdmin, "role" | "permissions">, requirement: PageRequirement): boolean {
  if (requirement === "ANY_ADMIN") return true;
  if (requirement === "SUPERADMIN") return isSuperadmin(admin);
  if (Array.isArray(requirement)) return doesAdminHaveAnyPermission(admin, requirement);
  return doesAdminHavePermission(admin, requirement as AdminPermission);
}
