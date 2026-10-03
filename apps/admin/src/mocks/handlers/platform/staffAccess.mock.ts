import { isKnownAdminPermission, type AdminPermission } from "@/constants/adminPermissions.constant";
import { adminRoleTemplates } from "@/constants/adminRoleTemplates.constant";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, failValidation } from "@/mocks/mockResponses.mock";
import type { MockPrincipal, MockRequest } from "@/mocks/mockRouter.mock";
import type { AdminRoleDefinition, StaffSettings } from "@/types/admin.type";

interface StaffStore {
  settings: StaffSettings;
  customRoles: AdminRoleDefinition[];
}

function readStaffStore(): StaffStore {
  return readMockAreaStore<StaffStore>("platform:staff", () => ({ settings: { requireSecondSuperadminApproval: true }, customRoles: [] }));
}

export const readStaffSettings = (): StaffSettings => readStaffStore().settings;
export const writeStaffSettings = (settings: StaffSettings): void => { readStaffStore().settings = settings; };

export function listRoleDefinitions(): AdminRoleDefinition[] {
  const templates = adminRoleTemplates.map((template): AdminRoleDefinition => ({ ...template, isTemplate: true }));
  return [...templates, ...readStaffStore().customRoles];
}

export function addCustomRole(role: AdminRoleDefinition): void {
  readStaffStore().customRoles.push(role);
}

export function requireStaffManager(request: MockRequest): MockPrincipal {
  return requireMockPermission(request, "staff:manage");
}

export function readRoleNames(roleIds: readonly string[]): string[] {
  const definitions = listRoleDefinitions();
  return roleIds.map((id) => definitions.find((role) => role.id === id)?.name ?? id);
}

export function readRoleIdList(body: Record<string, unknown>): string[] {
  if (body.roleIds === undefined) return [];
  if (!Array.isArray(body.roleIds)) failValidation("roleIds", "Send a list of role ids.");
  const known = new Set(listRoleDefinitions().map((role) => role.id));
  const unknown = body.roleIds.filter((id) => typeof id !== "string" || !known.has(id));
  if (unknown.length > 0) failValidation("roleIds", `Unknown roles: ${unknown.join(", ")}.`);
  return [...new Set(body.roleIds as string[])];
}

export function readExplicitPermissions(body: Record<string, unknown>): AdminPermission[] {
  if (body.permissions === undefined) return [];
  if (!Array.isArray(body.permissions)) failValidation("permissions", "Send a list of permissions.");
  const unknown = body.permissions.filter((permission) => typeof permission !== "string" || !isKnownAdminPermission(permission));
  if (unknown.length > 0) failValidation("permissions", `Unknown permissions: ${unknown.join(", ")}.`);
  return body.permissions as AdminPermission[];
}

export function resolveEffectivePermissions(roleIds: readonly string[], explicit: readonly AdminPermission[]): AdminPermission[] {
  const definitions = listRoleDefinitions();
  return [...new Set([...explicit, ...roleIds.flatMap((id) => definitions.find((role) => role.id === id)?.permissions ?? [])])];
}

export function assertPrincipalCanGrant(principal: MockPrincipal, permissions: readonly AdminPermission[]): void {
  if (principal.role === "SUPERADMIN") return;
  const missing = permissions.filter((permission) => !principal.permissions.includes(permission));
  if (missing.length > 0) throw new MockHttpError(403, "CANNOT_GRANT_UNHELD_PERMISSION", `You can only grant permissions you hold. Missing: ${missing.join(", ")}.`);
}
