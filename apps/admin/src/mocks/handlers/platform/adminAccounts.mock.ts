import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { revokeEveryMockSessionForAdmin } from "@/mocks/mockAuthTokens.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failNotFound, failValidation, matchesSearchText, paginateByCursor, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";
import type { AdminAccountSummary } from "@/types/admin.type";

import { assertPrincipalCanGrant, readExplicitPermissions, readRoleIdList, readRoleNames, readStaffSettings, requireStaffManager, resolveEffectivePermissions } from "./staffAccess.mock";

export function presentAdminAccountSummary(admin: MockAdminRecord): AdminAccountSummary {
  const isLocked = admin.lockedUntilEpochMs > Date.now();
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    status: isLocked && admin.status === "ACTIVE" ? "LOCKED" : admin.status,
    permissions: admin.permissions,
    roleIds: admin.roleIds,
    roleNames: readRoleNames(admin.roleIds),
    approvedByName: admin.approvedByName,
    mfaEnrolled: admin.mfaEnrolled,
    passkeyCount: admin.passkeys.length,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    createdByName: admin.createdByName,
  };
}

function readAccessSelection(body: Record<string, unknown>) {
  const roleIds = readRoleIdList(body);
  const permissions = resolveEffectivePermissions(roleIds, readExplicitPermissions(body));
  if (permissions.length === 0) failValidation("permissions", "Choose a role or at least one permission.");
  return { roleIds, permissions };
}

export function findManageableAdminOrFail(request: MockRequest, options: { readonly forbidSuperadminTarget?: boolean } = {}): MockAdminRecord {
  const principal = requireStaffManager(request);
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === request.params.adminId);
  if (!admin) failNotFound("Admin");
  if (admin.id === principal.adminId) throw new MockHttpError(409, "CANNOT_CHANGE_SELF", "You cannot change your own admin account here.");
  if (admin.role === "SUPERADMIN") {
    if (principal.role !== "SUPERADMIN") throw new MockHttpError(403, "ADMINS_CANNOT_EDIT_SUPERADMINS", "Only a superadmin can change a superadmin.");
    if (options.forbidSuperadminTarget) throw new MockHttpError(409, "SUPERADMIN_PERMISSIONS_FIXED", "Superadmins always hold every permission.");
  }
  return admin;
}

const auditTargetForAdmin = (admin: MockAdminRecord) => ({ type: "admin", id: admin.id, label: admin.name });

export function registerAdminAccountMockHandlers(): void {
  registerMockRoute("GET", "/admin/admins", (request) => {
    requireStaffManager(request);
    const search = request.query.get("search");
    const status = request.query.get("status");
    const role = request.query.get("role");
    const admins = readMockDatabase()
      .admins.map(presentAdminAccountSummary)
      .filter((admin) => matchesSearchText(search, admin.name, admin.email) && (!status || admin.status === status) && (!role || admin.role === role));
    return respondWithJson(200, paginateByCursor(admins, request));
  });

  registerMockRoute("GET", "/admin/admins/:adminId", (request) => {
    requireStaffManager(request);
    const admin = readMockDatabase().admins.find((candidate) => candidate.id === request.params.adminId);
    if (!admin) failNotFound("Admin");
    const lastActions = readMockDatabase().auditEntries.filter((entry) => entry.actor.id === admin.id).slice(0, 15);
    const sessions = [...readMockDatabase().adminSessions.values()].filter((session) => session.adminId === admin.id && !session.revoked);
    return respondWithJson(200, { admin: presentAdminAccountSummary(admin), activeSessionCount: sessions.length, lastActions, history: listMockAuditEntriesForTarget("admin", admin.id).slice(0, 20) });
  });

  registerMockRoute("POST", "/admin/admins", (request) => {
    const principal = requireStaffManager(request);
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const email = readRequiredTrimmedString(body, "email", 254).toLowerCase();
    if (!/^[^\s@]+@example\.com$/.test(email)) failValidation("email", "Admins must use an email on an approved work domain (demo: @example.com).");
    const name = readRequiredTrimmedString(body, "name", 80, 2);
    const role = readEnumValue(body, "role", ["ADMIN", "SUPPORT", "SUPERADMIN"] as const);
    if (role === "SUPERADMIN" && principal.role !== "SUPERADMIN") throw new MockHttpError(403, "ADMINS_CANNOT_CREATE_SUPERADMINS", "Only a superadmin can create a superadmin.");
    const selection = role === "SUPERADMIN" ? { roleIds: [], permissions: [] } : readAccessSelection(body);
    assertPrincipalCanGrant(principal, selection.permissions);
    const { roleIds, permissions } = selection;
    const needsApproval = role === "SUPERADMIN" && readStaffSettings().requireSecondSuperadminApproval;
    const reason = readRequiredReason(body);
    if (readMockDatabase().admins.some((admin) => admin.email === email)) failConflict("ADMIN_EXISTS", "An admin with this email already exists.");
    const admin: MockAdminRecord = {
      id: createMockId("adm"), email, name, role, status: needsApproval ? "PENDING_APPROVAL" : "INVITED", permissions, roleIds, approvedByName: null, mfaEnrolled: false, pendingTotpSecret: null, recoveryCodes: [], passkeys: [],
      failedLoginAttempts: 0, lockedUntilEpochMs: 0, lastLoginAt: null, createdAt: readIsoNow(), createdByName: principal.name,
    };
    readMockDatabase().admins.push(admin);
    recordMockAuditEntry(request, { action: "admin.created", area: "admins", target: auditTargetForAdmin(admin), reason, before: null, after: { email, name, role, roleIds, permissions, status: admin.status, needsSecondSuperadminApproval: needsApproval } });
    return respondWithJson(201, { admin: presentAdminAccountSummary(admin), invitationSentTo: email, invitationExpiresInHours: 48 });
  });

  registerMockRoute("PUT", "/admin/admins/:adminId/permissions", (request) => {
    requireMockStepUp(request);
    const principal = requireStaffManager(request);
    const admin = findManageableAdminOrFail(request, { forbidSuperadminTarget: true });
    const body = readJsonObjectBody(request);
    const { roleIds, permissions } = readAccessSelection(body);
    assertPrincipalCanGrant(principal, permissions);
    const role = body.role === undefined ? admin.role : readEnumValue(body, "role", ["ADMIN", "SUPPORT"] as const);
    const reason = readRequiredReason(body);
    const before = { role: admin.role, roleIds: [...admin.roleIds], permissions: [...admin.permissions] };
    admin.permissions = permissions;
    admin.roleIds = roleIds;
    admin.role = role;
    recordMockAuditEntry(request, { action: "admin.permissions_changed", area: "admins", target: auditTargetForAdmin(admin), reason, before, after: { role, roleIds, permissions } });
    return respondWithJson(200, { admin: presentAdminAccountSummary(admin) });
  });

  for (const action of ["disable", "enable", "reset-mfa"] as const) {
    registerMockRoute("POST", `/admin/admins/:adminId/${action}`, (request) => {
      requireMockStepUp(request);
      const admin = findManageableAdminOrFail(request);
      const reason = readRequiredReason(readJsonObjectBody(request));
      const before = { status: admin.status, mfaEnrolled: admin.mfaEnrolled, locked: admin.lockedUntilEpochMs > Date.now() };
      if (admin.status === "REVOKED") throw new MockHttpError(409, "ACCESS_REVOKED", "Revoked access is permanent. Invite the person again if needed.");
      if (action === "disable") {
        admin.status = "DISABLED";
        revokeEveryMockSessionForAdmin(admin.id);
      } else if (action === "enable") {
        if (admin.status === "DISABLED" || admin.status === "SUSPENDED") admin.status = "ACTIVE";
        admin.lockedUntilEpochMs = 0;
        admin.failedLoginAttempts = 0;
      } else {
        admin.mfaEnrolled = false;
        admin.pendingTotpSecret = null;
        admin.recoveryCodes = [];
        admin.passkeys = [];
        revokeEveryMockSessionForAdmin(admin.id);
      }
      const after = { status: admin.status, mfaEnrolled: admin.mfaEnrolled, locked: admin.lockedUntilEpochMs > Date.now() };
      recordMockAuditEntry(request, { action: `admin.${action.replace("-", "_")}`, area: "admins", target: auditTargetForAdmin(admin), reason, before, after });
      return respondWithJson(200, { admin: presentAdminAccountSummary(admin) });
    });
  }
}
