import { isKnownAdminPermission, type AdminPermission } from "@/constants/adminPermissions.constant";
import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { revokeEveryMockSessionForAdmin } from "@/mocks/mockAuthTokens.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStepUp, requireMockSuperadmin } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failNotFound, failValidation, matchesSearchText, paginateItems, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";
import type { AdminAccountSummary } from "@/types/admin.type";

export function presentAdminAccountSummary(admin: MockAdminRecord): AdminAccountSummary {
  const isLocked = admin.lockedUntilEpochMs > Date.now();
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    status: isLocked && admin.status === "ACTIVE" ? "LOCKED" : admin.status,
    permissions: admin.permissions,
    mfaEnrolled: admin.mfaEnrolled,
    passkeyCount: admin.passkeys.length,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    createdByName: admin.createdByName,
  };
}

function readPermissionList(body: Record<string, unknown>): AdminPermission[] {
  const permissions = body.permissions;
  if (!Array.isArray(permissions)) failValidation("permissions", "Choose at least one permission.");
  const unknown = permissions.filter((permission) => typeof permission !== "string" || !isKnownAdminPermission(permission));
  if (unknown.length > 0) failValidation("permissions", `Unknown permissions: ${unknown.join(", ")}.`);
  if (permissions.length === 0) failValidation("permissions", "Choose at least one permission.");
  return [...new Set(permissions as AdminPermission[])];
}

function findManageableAdminOrFail(request: MockRequest): MockAdminRecord {
  const principal = requireMockSuperadmin(request);
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === request.params.adminId);
  if (!admin) failNotFound("Admin");
  if (admin.id === principal.adminId) throw new MockHttpError(409, "CANNOT_CHANGE_SELF", "You cannot change your own admin account here.");
  if (admin.role === "SUPERADMIN") throw new MockHttpError(409, "SUPERADMIN_PROTECTED", "Superadmins are managed with the backend CLI only.");
  return admin;
}

const auditTargetForAdmin = (admin: MockAdminRecord) => ({ type: "admin", id: admin.id, label: admin.name });

export function registerAdminAccountMockHandlers(): void {
  registerMockRoute("GET", "/admin/admins", (request) => {
    requireMockSuperadmin(request);
    const search = request.query.get("search");
    const status = request.query.get("status");
    const role = request.query.get("role");
    const admins = readMockDatabase()
      .admins.map(presentAdminAccountSummary)
      .filter((admin) => matchesSearchText(search, admin.name, admin.email) && (!status || admin.status === status) && (!role || admin.role === role));
    return respondWithJson(200, paginateItems(admins, request));
  });

  registerMockRoute("GET", "/admin/admins/:adminId", (request) => {
    requireMockSuperadmin(request);
    const admin = readMockDatabase().admins.find((candidate) => candidate.id === request.params.adminId);
    if (!admin) failNotFound("Admin");
    const sessions = [...readMockDatabase().adminSessions.values()].filter((session) => session.adminId === admin.id && !session.revoked);
    return respondWithJson(200, { admin: presentAdminAccountSummary(admin), activeSessionCount: sessions.length, history: listMockAuditEntriesForTarget("admin", admin.id).slice(0, 20) });
  });

  registerMockRoute("POST", "/admin/admins", (request) => {
    const principal = requireMockSuperadmin(request);
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const email = readRequiredTrimmedString(body, "email", 254).toLowerCase();
    if (!/^[^\s@]+@example\.com$/.test(email)) failValidation("email", "Admins must use an email on an approved work domain (demo: @example.com).");
    const name = readRequiredTrimmedString(body, "name", 80, 2);
    const role = readEnumValue(body, "role", ["ADMIN", "SUPPORT"] as const);
    const permissions = readPermissionList(body);
    const reason = readRequiredReason(body);
    if (readMockDatabase().admins.some((admin) => admin.email === email)) failConflict("ADMIN_EXISTS", "An admin with this email already exists.");
    const admin: MockAdminRecord = {
      id: createMockId("adm"), email, name, role, status: "INVITED", permissions, mfaEnrolled: false, pendingTotpSecret: null, recoveryCodes: [], passkeys: [],
      failedLoginAttempts: 0, lockedUntilEpochMs: 0, lastLoginAt: null, createdAt: readIsoNow(), createdByName: principal.name,
    };
    readMockDatabase().admins.push(admin);
    recordMockAuditEntry(request, { action: "admin.created", area: "admins", target: auditTargetForAdmin(admin), reason, before: null, after: { email, name, role, permissions, status: "INVITED" } });
    return respondWithJson(201, { admin: presentAdminAccountSummary(admin), invitationSentTo: email, invitationExpiresInHours: 48 });
  });

  registerMockRoute("PUT", "/admin/admins/:adminId/permissions", (request) => {
    requireMockStepUp(request);
    const admin = findManageableAdminOrFail(request);
    const body = readJsonObjectBody(request);
    const permissions = readPermissionList(body);
    const role = body.role === undefined ? admin.role : readEnumValue(body, "role", ["ADMIN", "SUPPORT"] as const);
    const reason = readRequiredReason(body);
    const before = { role: admin.role, permissions: [...admin.permissions] };
    admin.permissions = permissions;
    admin.role = role;
    recordMockAuditEntry(request, { action: "admin.permissions_changed", area: "admins", target: auditTargetForAdmin(admin), reason, before, after: { role, permissions } });
    return respondWithJson(200, { admin: presentAdminAccountSummary(admin) });
  });

  for (const action of ["disable", "enable", "reset-mfa"] as const) {
    registerMockRoute("POST", `/admin/admins/:adminId/${action}`, (request) => {
      requireMockStepUp(request);
      const admin = findManageableAdminOrFail(request);
      const reason = readRequiredReason(readJsonObjectBody(request));
      const before = { status: admin.status, mfaEnrolled: admin.mfaEnrolled, locked: admin.lockedUntilEpochMs > Date.now() };
      if (action === "disable") {
        admin.status = "DISABLED";
        revokeEveryMockSessionForAdmin(admin.id);
      } else if (action === "enable") {
        if (admin.status === "DISABLED") admin.status = "ACTIVE";
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
