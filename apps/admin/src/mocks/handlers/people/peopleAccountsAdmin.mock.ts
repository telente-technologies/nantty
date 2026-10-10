import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp, requireMockSuperadmin } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failValidation, paginateByCursor, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { maskEmailAddress, presentPlatformUserSummary, type MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { AdminCreatedAccount, CheckmarkGrant, ProfileType } from "@/types/accountsAdmin.type";
import type { UserVerificationSummary, VerificationColor, VerificationTier } from "@/types/platformUser.type";
import { isValidUsernameShape, normalizeUsernameForComparison } from "@/utils/usernameConfusables.util";

import { findReservedCollisionsForCandidate } from "./peopleUsernames.mock";
import { asMutablePlatformUser, findPlatformUserForPeopleOrFail } from "./peopleStore.mock";

interface GrantRecord {
  readonly id: string;
  readonly userId: string;
  readonly color: VerificationColor;
  readonly reason: string;
  readonly grantedByName: string;
  readonly grantedAt: string;
  readonly previous: UserVerificationSummary | null;
  revokedAt: string | null;
  revokedByName: string | null;
  revokedReason: string | null;
}

interface CreatedRecord extends Omit<AdminCreatedAccount, "user"> {
  readonly userId: string;
}

interface AccountsAdminStore {
  readonly profileTypes: Map<string, ProfileType>;
  readonly created: CreatedRecord[];
  readonly grants: GrantRecord[];
}

const tierByColor: Record<VerificationColor, VerificationTier> = { BLUE: "VERIFIED", GOLD: "PRO", BLACK: "OFFICIAL" };
const countries = ["NG", "GH", "KE", "ZA", "GB", "US"] as const;

function readStore(): AccountsAdminStore {
  return readMockAreaStore<AccountsAdminStore>("people:accountsAdmin", () => ({ profileTypes: new Map(), created: [], grants: [] }));
}

const colorByProfileType: Record<ProfileType, VerificationColor> = { PERSONAL: "BLUE", BUSINESS: "GOLD", BRAND: "GOLD", GOVERNMENT: "BLACK" };

export function readProfileTypeForUser(user: MockPlatformUserRecord): ProfileType {
  const stored = readStore().profileTypes.get(user.id);
  if (stored) return stored;
  if (user.verification?.color === "BLACK") return "GOVERNMENT";
  if (user.isSeller) return "BUSINESS";
  return "PERSONAL";
}

function presentGrant(record: GrantRecord): CheckmarkGrant {
  return { ...record, user: presentPlatformUserSummary(findPlatformUserForPeopleOrFail(record.userId)) };
}

function validatePassword(password: string): void {
  if (password.length < 12) failValidation("password", "Use at least 12 characters.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) failValidation("password", "Mix upper case, lower case and a number.");
}

function findUserByUsernameOrFail(username: string) {
  const normalized = normalizeUsernameForComparison(username);
  const user = readMockDatabase().platformUsers.find((candidate) => candidate.username === normalized);
  if (!user) failValidation("username", `No account uses @${normalized}.`);
  return user;
}

export function registerPeopleAccountsAdminMockHandlers(): void {
  registerMockRoute("GET", "/admin/accounts/created", (request) => {
    requireMockPermission(request, "users:read");
    const items = readStore().created.map((record): AdminCreatedAccount => ({ ...record, user: presentPlatformUserSummary(findPlatformUserForPeopleOrFail(record.userId)) }));
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("POST", "/admin/accounts", (request) => {
    const principal = requireMockSuperadmin(request);
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const username = normalizeUsernameForComparison(readRequiredTrimmedString(body, "username", 30, 3));
    const displayName = readRequiredTrimmedString(body, "displayName", 60, 2);
    const email = readRequiredTrimmedString(body, "email", 120, 5).toLowerCase();
    const password = readRequiredTrimmedString(body, "password", 128, 12);
    const country = readEnumValue(body, "country", countries);
    const profileType = readEnumValue(body, "profileType", ["PERSONAL", "BUSINESS", "BRAND", "GOVERNMENT"] as const);
    const reason = readRequiredReason(body);
    if (!isValidUsernameShape(username)) failValidation("username", "Use 3–30 lowercase letters, numbers, dots or underscores.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) failValidation("email", "Enter a valid email address.");
    validatePassword(password);
    const database = readMockDatabase();
    if (database.platformUsers.some((user) => user.username === username)) failConflict("USERNAME_TAKEN", `@${username} is already taken.`);
    if (database.platformUsers.some((user) => user.personalData.email === email)) failConflict("EMAIL_TAKEN", "An account already uses that email.");
    const bypassedReservedEntries = findReservedCollisionsForCandidate(username).map((collision) => `${collision.value} (${collision.kind.toLowerCase()})`);
    const record: MockPlatformUserRecord = {
      id: `usr_${String(database.platformUsers.length + 1).padStart(4, "0")}`, username, displayName, avatarUrl: null, country, currency: country === "NG" ? "NGN" : country === "GH" ? "GHS" : country === "KE" ? "KES" : country === "ZA" ? "ZAR" : country === "GB" ? "GBP" : "USD",
      status: "ACTIVE", verification: null, isSeller: false, isCreator: false, followerCount: 0, joinedAt: readIsoNow(), lastActiveAt: readIsoNow(), strikeCount: 0, riskLevel: "LOW",
      personalData: { email, phone: "", legalName: displayName, dateOfBirth: null },
    };
    database.platformUsers.push(record);
    readStore().profileTypes.set(record.id, profileType);
    const created: CreatedRecord = { id: createMockId("acc"), userId: record.id, profileType, createdAt: record.joinedAt, createdByName: principal.name, reason, mustChangePassword: true, bypassedReservedEntries };
    readStore().created.unshift(created);
    recordMockAuditEntry(request, { action: "account.created_by_admin", area: "accounts", target: { type: "user", id: record.id, label: `@${username}` }, reason, before: null, after: { username, profileType, email: maskEmailAddress(email), mustChangePassword: true, reservedCheckBypassed: bypassedReservedEntries.length > 0, bypassedReservedEntries } });
    return respondWithJson(201, { ...created, user: presentPlatformUserSummary(record) } satisfies AdminCreatedAccount);
  });

  registerMockRoute("GET", "/admin/checkmark-grants", (request) => {
    requireMockPermission(request, "verification:grant", "verification:revoke");
    const status = request.query.get("status") ?? "ACTIVE";
    const items = readStore().grants.filter((record) => status === "ALL" || (status === "ACTIVE" ? record.revokedAt === null : record.revokedAt !== null)).map(presentGrant);
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("POST", "/admin/checkmark-grants", (request) => {
    const principal = requireMockPermission(request, "verification:grant");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const color = readEnumValue(body, "color", ["BLUE", "GOLD", "BLACK"] as const);
    if (color === "BLACK" && principal.role !== "SUPERADMIN") throw new MockHttpError(403, "BLACK_ADMIN_ONLY", "Black checkmarks can only be granted by a superadmin.");
    const reason = readRequiredReason(body);
    const user = findUserByUsernameOrFail(readRequiredTrimmedString(body, "username", 40));
    const profileType = readProfileTypeForUser(user);
    if (colorByProfileType[profileType] !== color) failValidation("color", `@${user.username} is a ${profileType.toLowerCase()} profile, which can only have a ${colorByProfileType[profileType].toLowerCase()} checkmark.`);
    if (readStore().grants.some((record) => record.userId === user.id && record.revokedAt === null)) failConflict("ALREADY_GRANTED", `@${user.username} already has a free lifetime checkmark. Revoke it first to change colour.`);
    const previous = user.verification;
    const record: GrantRecord = { id: createMockId("cmg"), userId: user.id, color, reason, grantedByName: principal.name, grantedAt: readIsoNow(), previous, revokedAt: null, revokedByName: null, revokedReason: null };
    readStore().grants.unshift(record);
    asMutablePlatformUser(user).verification = { color, tier: tierByColor[color], status: "VERIFIED", badgeVisible: true };
    if (color === "GOLD") asMutablePlatformUser(user).isSeller = true;
    recordMockAuditEntry(request, { action: "checkmark.lifetime_granted", area: "verification", target: { type: "user", id: user.id, label: `@${user.username}` }, reason, before: { verification: previous }, after: { verification: user.verification, billing: "FREE_FOR_LIFE", profileType } });
    return respondWithJson(201, presentGrant(record));
  });

  registerMockRoute("POST", "/admin/checkmark-grants/:grantId/revoke", (request) => {
    const principal = requireMockPermission(request, "verification:revoke");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = readStore().grants.find((candidate) => candidate.id === request.params.grantId);
    if (!record) throw new MockHttpError(404, "NOT_FOUND", "Checkmark grant was not found.");
    if (record.revokedAt) failConflict("ALREADY_REVOKED", "This grant was already revoked.");
    if (record.color === "BLACK" && principal.role !== "SUPERADMIN") throw new MockHttpError(403, "BLACK_ADMIN_ONLY", "Only a superadmin can revoke a Black checkmark.");
    const user = findPlatformUserForPeopleOrFail(record.userId);
    record.revokedAt = readIsoNow();
    record.revokedByName = principal.name;
    record.revokedReason = reason;
    const before = user.verification;
    asMutablePlatformUser(user).verification = record.previous;
    recordMockAuditEntry(request, { action: "checkmark.lifetime_revoked", area: "verification", target: { type: "user", id: user.id, label: `@${user.username}` }, reason, before: { verification: before }, after: { verification: record.previous } });
    return respondWithJson(200, presentGrant(record));
  });
}
