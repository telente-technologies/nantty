import { convertAccessToSellerPlan, isFeatureIncludedInPlan } from "@/config/planFeatures.config";
import { sellerPermissions, type SellerPermission } from "@/config/rolePermissions.config";
import { staffRoles } from "@/constants/roles.constant";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { assertStaffSeatAvailable, describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { createMockIdentifier, matchesSearchText, MockHttpError, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { buildDemoUserAccounts, type MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember, NanttyUserCandidate } from "@/types/staff.type";
import { fieldChecks, validateObjectAgainstChecks, type ValidationIssue } from "@/utils/formValidation.util";

const invitableRoles = staffRoles.filter((role) => role !== "owner");

function convertStaffRecordToPublicMember(record: MockStaffRecord): StaffMember {
  return record;
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
  if (role === "manager" && principal.role !== "owner") throw new MockHttpError(403, "OWNER_ONLY", "Only the store owner can make someone a manager.");
}

function assertActorMayManageMember(request: MockRequest, target: MockStaffRecord): void {
  const principal = requireMockStorePrincipal(request);
  if (target.role === "owner") throw new MockHttpError(403, "OWNER_PROTECTED", "The store owner cannot be changed here.");
  if (target.role === "manager" && principal.role !== "owner") throw new MockHttpError(403, "OWNER_ONLY", "Only the store owner can change a manager.");
}

const permissionsReservedForOwner = new Set<SellerPermission>(["billing:manage", "developer:manage", "wallet:withdraw"]);

function readCustomPermissionsFromBody(storeId: string, value: unknown, issues: ValidationIssue[]): SellerPermission[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  if (!isFeatureIncludedInPlan("advanced_permissions", convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null }))) {
    throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", "Custom permissions are part of the Business plan.");
  }
  if (!Array.isArray(value) || value.some((permission) => typeof permission !== "string" || !(sellerPermissions as readonly string[]).includes(permission))) {
    issues.push({ path: "permissions", message: "Choose permissions from the list." });
    return undefined;
  }
  if (value.some((permission) => permissionsReservedForOwner.has(permission as SellerPermission))) {
    issues.push({ path: "permissions", message: "Billing, withdrawals and developer access stay with the owner." });
    return undefined;
  }
  return [...new Set(value as SellerPermission[])];
}

function recordStaffAudit(request: MockRequest, action: string, target: MockStaffRecord, summary: string): void {
  appendMockAuditLogEntry({ actor: describeMockActor(requireMockStorePrincipal(request)), action, targetType: "staff", targetId: target.id, summary });
}

export function registerStaffTeamMockHandlers(): void {
  registerMockRoute("GET", "/seller/staff", (request) => {
    requireMockStorePrincipal(request);
    const searchText = request.query.get("q");
    const members = readMockDatabase().staff.filter((staff) => matchesSearchText(searchText, staff.name, staff.username)).map(convertStaffRecordToPublicMember);
    return respondWithJson(200, paginateMockList(members, request.query, 100));
  });

  registerMockRoute("GET", "/seller/staff/candidates", (request) => {
    requireMockStorePrincipal(request);
    const searchText = (request.query.get("q") ?? "").trim().replace(/^@/, "");
    if (searchText.length < 2) return respondWithJson(200, { data: [] });
    const existingStaffUserIds = new Set(readMockDatabase().staff.map((staff) => staff.userId));
    const candidates = buildDemoUserAccounts()
      .filter((account) => !existingStaffUserIds.has(account.id) && matchesSearchText(searchText, account.name, account.username))
      .slice(0, 10)
      .map((account): NanttyUserCandidate => ({ userId: account.id, name: account.name, username: account.username, avatarUrl: account.avatarUrl }));
    return respondWithJson(200, { data: candidates });
  });

  registerMockRoute("GET", "/seller/nantty-users", (request) => {
    requireMockStorePrincipal(request);
    const searchText = (request.query.get("q") ?? "").trim().replace(/^@/, "");
    if (searchText.length < 2) return respondWithJson(200, { data: [] });
    const matchingUsers = buildDemoUserAccounts()
      .filter((account) => matchesSearchText(searchText, account.name, account.username))
      .slice(0, 10)
      .map((account): NanttyUserCandidate => ({ userId: account.id, name: account.name, username: account.username, avatarUrl: account.avatarUrl }));
    return respondWithJson(200, { data: matchingUsers });
  });

  registerMockRoute("POST", "/seller/staff", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, { role: fieldChecks.oneOf("Role", invitableRoles) });
    const zudomartAccount = buildDemoUserAccounts().find((account) => account.id === body.userId);
    if (!zudomartAccount) issues.push({ path: "userId", message: "Choose someone who already has a Nantty account." });
    const locationIds = validateLocationIds(body.locationIds, issues);
    const customPermissions = readCustomPermissionsFromBody(principal.storeId, body.permissions, issues);
    if (issues.length > 0 || !zudomartAccount) return respondWithValidationFailure(issues);
    const role = body.role as StaffRole;
    assertActorMayAssignRole(request, role);
    const database = readMockDatabase();
    if (database.staff.some((staff) => staff.userId === zudomartAccount.id)) {
      throw new MockHttpError(409, "STAFF_EXISTS", `@${zudomartAccount.username} is already on your team.`);
    }
    assertStaffSeatAvailable(principal.storeId);
    const record: MockStaffRecord = {
      id: createMockIdentifier("stf"),
      userId: zudomartAccount.id,
      name: zudomartAccount.name,
      username: zudomartAccount.username,
      avatarUrl: zudomartAccount.avatarUrl,
      role,
      status: "invited",
      permissions: customPermissions ?? null,
      locationIds,
      lastActiveAt: null,
      invitedAt: new Date().toISOString(),
    };
    database.staff.push(record);
    recordStaffAudit(request, "staff.invited", record, `Sent a team request to @${record.username} as ${role}`);
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
    const customPermissions = readCustomPermissionsFromBody(principal.storeId, body.permissions, issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const isSelf = target.id === principal.staffId;
    if (isSelf && (body.role !== undefined || body.status !== undefined || body.permissions !== undefined)) throw new MockHttpError(403, "CANNOT_EDIT_SELF", "You cannot change your own role or status. Ask the owner.");
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
      permissions: customPermissions === undefined ? target.permissions : customPermissions,
    };
    database.staff[staffIndex] = updated;
    const changes = [body.role !== undefined && body.role !== target.role ? `role ${target.role} → ${updated.role}` : null, body.status !== undefined && body.status !== target.status ? `status ${target.status} → ${updated.status}` : null, body.locationIds !== undefined ? "locations" : null, body.permissions !== undefined ? (customPermissions ? "custom permissions" : "permissions reset to role defaults") : null].filter(Boolean);
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
    recordStaffAudit(request, "staff.removed", target, `Removed ${target.name} from the team`);
    return respondWithNoContent();
  });

  registerMockRoute("GET", "/seller/audit-log", (request) => {
    requireMockStorePrincipal(request);
    const actorId = request.query.get("actorId");
    const action = request.query.get("action");
    const from = request.query.get("from");
    const to = request.query.get("to");
    const fromTime = from ? new Date(`${from}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = to ? new Date(`${to}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
    const database = readMockDatabase();
    const actorIds = new Set([actorId, ...database.staff.filter((member) => member.userId === actorId).map((member) => member.id)]);
    const entries = database.auditLog.filter((entry) => {
      const createdTime = new Date(entry.createdAt).getTime();
      return (!actorId || actorIds.has(entry.actor.id)) && (!action || entry.action.startsWith(action)) && createdTime >= fromTime && createdTime <= toTime;
    });
    return respondWithJson(200, paginateMockList(entries, request.query, 50));
  });
}
