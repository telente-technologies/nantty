import { staffRoles } from "@/constants/roles.constant";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { assertStaffSeatAvailable, describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { createMockIdentifier, matchesSearchText, MockHttpError, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { hashPosPinForStorage, type MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";
import { fieldChecks, validateObjectAgainstChecks, type ValidationIssue } from "@/utils/formValidation.util";

const invitableRoles = staffRoles.filter((role) => role !== "owner");

function convertStaffRecordToPublicMember(record: MockStaffRecord): StaffMember {
  const { pinHash: _pinHash, failedPinAttempts: _failedPinAttempts, ...member } = record;
  return member;
}

function findStaffIndexOrThrow(staffId: string): number {
  const staffIndex = readMockDatabase().staff.findIndex((staff) => staff.id === staffId);
  if (staffIndex < 0) throw new MockHttpError(404, "STAFF_NOT_FOUND", "That team member no longer exists.");
  return staffIndex;
}

function validateLocationIds(value: unknown, issues: ValidationIssue[]): string[] {
  const knownLocationIds = new Set(readMockDatabase().locations.map((location) => location.id));
  if (!Array.isArray(value) || value.length === 0 || value.some((locationId) => typeof locationId !== "string" || !knownLocationIds.has(locationId))) {
    issues.push({ path: "locationIds", message: "Pick at least one of your locations." });
    return [];
  }
  return [...new Set(value as string[])];
}

function assertActorMayAssignRole(request: MockRequest, role: StaffRole): void {
  const principal = requireMockStorePrincipal(request);
  if (role === "owner") throw new MockHttpError(403, "OWNER_ROLE_RESERVED", "There is only one owner per store.");
  if (role === "admin" && principal.role !== "owner") throw new MockHttpError(403, "OWNER_ONLY", "Only the store owner can make someone an admin.");
}

function assertActorMayManageMember(request: MockRequest, target: MockStaffRecord): void {
  const principal = requireMockStorePrincipal(request);
  if (target.role === "owner") throw new MockHttpError(403, "OWNER_PROTECTED", "The store owner cannot be changed here.");
  if (target.role === "admin" && principal.role !== "owner") throw new MockHttpError(403, "OWNER_ONLY", "Only the store owner can change an admin.");
}

function recordStaffAudit(request: MockRequest, action: string, target: MockStaffRecord, summary: string): void {
  appendMockAuditLogEntry({ actor: describeMockActor(requireMockStorePrincipal(request)), action, targetType: "staff", targetId: target.id, summary });
}

export function registerStaffTeamMockHandlers(): void {
  registerMockRoute("GET", "/seller/staff", (request) => {
    requireMockStorePrincipal(request);
    const searchText = request.query.get("q");
    const members = readMockDatabase().staff.filter((staff) => matchesSearchText(searchText, staff.name, staff.email, staff.phone)).map(convertStaffRecordToPublicMember);
    return respondWithJson(200, paginateMockList(members, request.query, 100));
  });

  registerMockRoute("POST", "/seller/staff", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, {
      name: fieldChecks.text({ label: "Name", min: 2, max: 80 }),
      email: fieldChecks.optional(fieldChecks.email()),
      phone: fieldChecks.optional(fieldChecks.phone()),
      role: fieldChecks.oneOf("Role", invitableRoles),
    });
    if (!body.email && !body.phone) issues.push({ path: "email", message: "Add an email or a phone number to send the invite to." });
    const locationIds = validateLocationIds(body.locationIds, issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const role = body.role as StaffRole;
    assertActorMayAssignRole(request, role);
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
    const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.replace(/[\s-]/g, "") : null;
    const database = readMockDatabase();
    if (database.staff.some((staff) => (email && staff.email === email) || (phone && staff.phone === phone))) {
      throw new MockHttpError(409, "STAFF_EXISTS", "Someone on your team already uses that email or phone number.");
    }
    assertStaffSeatAvailable(principal.storeId);
    const record: MockStaffRecord = {
      id: createMockIdentifier("stf"),
      userId: null,
      name: String(body.name).trim(),
      email,
      phone,
      role,
      status: "invited",
      hasPosPin: false,
      pinHash: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      locationIds,
      lastActiveAt: null,
      invitedAt: new Date().toISOString(),
    };
    database.staff.push(record);
    recordStaffAudit(request, "staff.invited", record, `Invited ${record.name} as ${role}`);
    return respondWithJson(201, convertStaffRecordToPublicMember(record));
  });

  registerMockRoute("PATCH", "/seller/staff/:staffId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const staffIndex = findStaffIndexOrThrow(request.params.staffId ?? "");
    const target = database.staff[staffIndex] as MockStaffRecord;
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, {
      name: fieldChecks.optional(fieldChecks.text({ label: "Name", min: 2, max: 80 })),
      role: fieldChecks.optional(fieldChecks.oneOf("Role", invitableRoles)),
      status: fieldChecks.optional(fieldChecks.oneOf("Status", ["active", "suspended"] as const)),
    });
    const locationIds = body.locationIds === undefined ? target.locationIds : validateLocationIds(body.locationIds, issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const isSelf = target.id === principal.staffId;
    if (isSelf && (body.role !== undefined || body.status !== undefined)) throw new MockHttpError(403, "CANNOT_EDIT_SELF", "You cannot change your own role or status. Ask the owner.");
    if (!isSelf) assertActorMayManageMember(request, target);
    if (body.role !== undefined) assertActorMayAssignRole(request, body.role as StaffRole);
    if (body.status === "active" && target.status === "suspended") assertStaffSeatAvailable(principal.storeId);
    const nextStatus = body.status === "active" && target.status === "suspended" && target.userId === null && target.lastActiveAt === null ? "invited" : (body.status as StaffMember["status"] | undefined) ?? target.status;
    const updated: MockStaffRecord = {
      ...target,
      name: typeof body.name === "string" ? body.name.trim() : target.name,
      role: (body.role as StaffRole | undefined) ?? target.role,
      status: nextStatus,
      locationIds,
    };
    database.staff[staffIndex] = updated;
    const changes = [body.role !== undefined && body.role !== target.role ? `role ${target.role} → ${updated.role}` : null, body.status !== undefined && body.status !== target.status ? `status ${target.status} → ${updated.status}` : null, body.locationIds !== undefined ? "locations" : null].filter(Boolean);
    recordStaffAudit(request, "staff.updated", updated, `Updated ${updated.name}${changes.length ? `: ${changes.join(", ")}` : ""}`);
    return respondWithJson(200, convertStaffRecordToPublicMember(updated));
  });

  registerMockRoute("DELETE", "/seller/staff/:staffId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const staffIndex = findStaffIndexOrThrow(request.params.staffId ?? "");
    const target = database.staff[staffIndex] as MockStaffRecord;
    if (target.id === principal.staffId) throw new MockHttpError(403, "CANNOT_REMOVE_SELF", "You cannot remove yourself.");
    assertActorMayManageMember(request, target);
    database.staff.splice(staffIndex, 1);
    for (const [operatorToken, operatorSession] of database.operatorSessions) if (operatorSession.staffId === target.id) database.operatorSessions.delete(operatorToken);
    recordStaffAudit(request, "staff.removed", target, `Removed ${target.name} from the team`);
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/seller/staff/:staffId/pin", (request) => {
    const database = readMockDatabase();
    const staffIndex = findStaffIndexOrThrow(request.params.staffId ?? "");
    const target = database.staff[staffIndex] as MockStaffRecord;
    const pin = readJsonObjectBody(request).pin;
    if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) return respondWithValidationFailure([{ path: "pin", message: "The PIN must be 4 to 6 digits." }]);
    if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return respondWithValidationFailure([{ path: "pin", message: "Pick a PIN that is harder to guess than a repeated digit or a straight run." }]);
    if (target.role === "owner" && target.id !== requireMockStorePrincipal(request).staffId) throw new MockHttpError(403, "OWNER_PROTECTED", "Only the owner can set the owner's PIN.");
    const updated: MockStaffRecord = { ...target, pinHash: hashPosPinForStorage(pin), hasPosPin: true, failedPinAttempts: 0, pinLockedUntil: null };
    database.staff[staffIndex] = updated;
    recordStaffAudit(request, "staff.pin_set", updated, `${target.hasPosPin ? "Reset" : "Set"} the register PIN for ${target.name}`);
    return respondWithJson(200, convertStaffRecordToPublicMember(updated));
  });

  registerMockRoute("POST", "/seller/staff/:staffId/unlock-pin", (request) => {
    const database = readMockDatabase();
    const staffIndex = findStaffIndexOrThrow(request.params.staffId ?? "");
    const target = database.staff[staffIndex] as MockStaffRecord;
    const updated: MockStaffRecord = { ...target, failedPinAttempts: 0, pinLockedUntil: null };
    database.staff[staffIndex] = updated;
    recordStaffAudit(request, "staff.pin_unlocked", updated, `Unlocked the register PIN for ${target.name}`);
    return respondWithJson(200, convertStaffRecordToPublicMember(updated));
  });

  registerMockRoute("GET", "/seller/audit-log", (request) => {
    requireMockStorePrincipal(request);
    const actorId = request.query.get("actorId");
    const action = request.query.get("action");
    const from = request.query.get("from");
    const to = request.query.get("to");
    const fromTime = from ? new Date(`${from}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = to ? new Date(`${to}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
    const entries = readMockDatabase().auditLog.filter((entry) => {
      const createdTime = new Date(entry.createdAt).getTime();
      return (!actorId || entry.actor.id === actorId) && (!action || entry.action.startsWith(action)) && createdTime >= fromTime && createdTime <= toTime;
    });
    return respondWithJson(200, paginateMockList(entries, request.query, 50));
  });
}
