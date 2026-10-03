import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { revokeEveryMockSessionForAdmin } from "@/mocks/mockAuthTokens.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStepUp, requireMockSuperadmin } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failValidation, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { AdminRoleDefinition } from "@/types/admin.type";

import { findManageableAdminOrFail, presentAdminAccountSummary } from "./adminAccounts.mock";
import { addCustomRole, assertPrincipalCanGrant, listRoleDefinitions, readExplicitPermissions, readStaffSettings, requireStaffManager, writeStaffSettings } from "./staffAccess.mock";

function guardLastSuperadmin(target: { id: string; role: string }): void {
  if (target.role !== "SUPERADMIN") return;
  const others = readMockDatabase().admins.filter((admin) => admin.role === "SUPERADMIN" && admin.status === "ACTIVE" && admin.id !== target.id);
  if (others.length === 0) throw new MockHttpError(409, "LAST_SUPERADMIN", "You cannot remove the last active superadmin.");
}

function cutAccess(request: MockRequest, kind: "suspended" | "revoked") {
  requireMockStepUp(request);
  const admin = findManageableAdminOrFail(request);
  const reason = readRequiredReason(readJsonObjectBody(request));
  if (admin.status === "REVOKED") failConflict("ACCESS_REVOKED", "This access is already revoked.");
  guardLastSuperadmin(admin);
  const before = { status: admin.status };
  admin.status = kind === "suspended" ? "SUSPENDED" : "REVOKED";
  revokeEveryMockSessionForAdmin(admin.id);
  recordMockAuditEntry(request, { action: `admin.access_${kind}`, area: "admins", target: { type: "admin", id: admin.id, label: admin.name }, reason, before, after: { status: admin.status, sessionsKilled: true } });
  return respondWithJson(200, { admin: presentAdminAccountSummary(admin) });
}

export function registerStaffManagementMockHandlers(): void {
  registerMockRoute("GET", "/admin/roles", (request) => {
    requireStaffManager(request);
    return respondWithJson(200, { items: listRoleDefinitions() });
  });

  registerMockRoute("POST", "/admin/roles", (request) => {
    const principal = requireStaffManager(request);
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 60, 3);
    const permissions = readExplicitPermissions(body);
    if (permissions.length === 0) failValidation("permissions", "Choose at least one permission.");
    assertPrincipalCanGrant(principal, permissions);
    const reason = readRequiredReason(body);
    if (listRoleDefinitions().some((role) => role.name.toLowerCase() === name.toLowerCase())) failConflict("ROLE_EXISTS", "A role with this name already exists.");
    const role: AdminRoleDefinition = { id: createMockId("role"), name, department: "Custom", permissions, isTemplate: false };
    addCustomRole(role);
    recordMockAuditEntry(request, { action: "role.created", area: "admins", target: { type: "role", id: role.id, label: name }, reason, before: null, after: { name, permissions } });
    return respondWithJson(201, role);
  });

  registerMockRoute("GET", "/admin/staff-settings", (request) => {
    requireStaffManager(request);
    return respondWithJson(200, readStaffSettings());
  });

  registerMockRoute("PUT", "/admin/staff-settings", (request) => {
    requireMockSuperadmin(request);
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    if (typeof body.requireSecondSuperadminApproval !== "boolean") failValidation("requireSecondSuperadminApproval", "Choose on or off.");
    const reason = readRequiredReason(body);
    const before = readStaffSettings();
    writeStaffSettings({ requireSecondSuperadminApproval: body.requireSecondSuperadminApproval });
    recordMockAuditEntry(request, { action: "staff_settings.changed", area: "admins", target: { type: "staffSettings", id: "staff", label: "Staff settings" }, reason, before, after: readStaffSettings() });
    return respondWithJson(200, readStaffSettings());
  });

  registerMockRoute("POST", "/admin/admins/:adminId/approve", (request) => {
    const principal = requireMockSuperadmin(request);
    requireMockStepUp(request);
    const admin = findManageableAdminOrFail(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    if (admin.status !== "PENDING_APPROVAL") failConflict("NOT_PENDING", "This superadmin is not waiting for approval.");
    if (admin.createdByName === principal.name) throw new MockHttpError(409, "SAME_SUPERADMIN", "A different superadmin must approve it.");
    admin.status = "INVITED";
    admin.approvedByName = principal.name;
    recordMockAuditEntry(request, { action: "admin.superadmin_approved", area: "admins", target: { type: "admin", id: admin.id, label: admin.name }, reason, before: { status: "PENDING_APPROVAL" }, after: { status: "INVITED", approvedBy: principal.name, createdBy: admin.createdByName } });
    return respondWithJson(200, { admin: presentAdminAccountSummary(admin) });
  });

  registerMockRoute("POST", "/admin/admins/:adminId/suspend", (request) => cutAccess(request, "suspended"));
  registerMockRoute("POST", "/admin/admins/:adminId/revoke", (request) => cutAccess(request, "revoked"));
}
