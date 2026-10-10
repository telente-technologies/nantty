import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failValidation, matchesSearchText, paginateByCursor, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary, type MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { UserDetail } from "@/types/peopleUsers.type";

import { blockSignupIdentifiers, clearSignupBlocks, notifyUser } from "./peopleUserActions.mock";
import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readPeopleMockStore, readUserExtrasForPeople } from "./peopleStore.mock";

export function buildUserDetailResponse(user: MockPlatformUserRecord): UserDetail {
  const extras = readUserExtrasForPeople(user.id);
  return {
    user: presentPlatformUserSummary(user),
    bio: extras.bio,
    restriction: extras.restriction,
    wallet: extras.wallet,
    strikes: extras.strikes,
    sessions: extras.sessions,
    usernameHistory: extras.usernameHistory,
    withheldUsername: readPeopleMockStore().withheldUsernames.find((entry) => entry.originalOwnerId === user.id) ?? null,
    history: listMockAuditEntriesForTarget("user", user.id),
  };
}

function matchesUserFilters(user: MockPlatformUserRecord, request: MockRequest): boolean {
  const status = request.query.get("status");
  const verification = request.query.get("verification");
  const role = request.query.get("role");
  const risk = request.query.get("risk");
  const verificationMatches = !verification || (verification === "NONE" ? !user.verification : user.verification?.color === verification);
  const roleMatches = !role || (role === "seller" && user.isSeller) || (role === "creator" && user.isCreator);
  return matchesSearchText(request.query.get("search"), user.username, user.displayName, user.id, `@${user.username}`) && (!status || user.status === status) && verificationMatches && roleMatches && (!risk || user.riskLevel === risk);
}

function readDurationInDays(body: Record<string, unknown>, isOptional: boolean): number | null {
  const value = body.durationDays;
  if ((value === null || value === undefined) && isOptional) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 365) failValidation("durationDays", "Choose a duration between 1 and 365 days.");
  return value;
}

const auditTargetForUser = (user: MockPlatformUserRecord) => ({ type: "user", id: user.id, label: `@${user.username}` });

function changeUserStatus(request: MockRequest, action: string, applyChange: (user: MockPlatformUserRecord, body: Record<string, unknown>, reason: string) => Record<string, unknown>) {
  const user = findPlatformUserForPeopleOrFail(request.params.userId);
  const body = readJsonObjectBody(request);
  const reason = readRequiredReason(body);
  const extras = readUserExtrasForPeople(user.id);
  const before = { status: user.status, strikeCount: user.strikeCount, restriction: extras.restriction, sessionCount: extras.sessions.length };
  const extraAfter = applyChange(user, body, reason);
  recordMockAuditEntry(request, { action, area: "users", target: auditTargetForUser(user), reason, before, after: { status: user.status, strikeCount: user.strikeCount, restriction: extras.restriction, sessionCount: extras.sessions.length, ...extraAfter } });
  return respondWithJson(200, buildUserDetailResponse(user));
}

export function registerPeopleUserMockHandlers(): void {
  registerMockRoute("GET", "/admin/users", (request) => {
    requireMockPermission(request, "users:read", "support:tickets", "verification:review", "moderation:reports");
    const users = readMockDatabase().platformUsers.filter((user) => matchesUserFilters(user, request)).map(presentPlatformUserSummary);
    return respondWithJson(200, paginateByCursor(users, request));
  });

  registerMockRoute("GET", "/admin/users/:userId", (request) => {
    requireMockPermission(request, "users:read", "support:tickets", "verification:review", "moderation:reports");
    return respondWithJson(200, buildUserDetailResponse(findPlatformUserForPeopleOrFail(request.params.userId)));
  });

  registerMockRoute("GET", "/admin/users/:userId/personal-data", (request) => {
    requireMockPermission(request, "users:read-pii");
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    recordMockAuditEntry(request, { action: "user.personal_data_revealed", area: "users", target: auditTargetForUser(user), reason: request.query.get("purpose") ?? null, after: { fields: ["email", "phone", "legalName", "dateOfBirth"] } });
    return respondWithJson(200, { ...user.personalData, revealedAt: readIsoNow(), expiresInSeconds: 60 });
  });

  registerMockRoute("POST", "/admin/users/:userId/warn", (request) => {
    requireMockPermission(request, "users:moderate");
    return changeUserStatus(request, "user.warned", (user, body, reason) => {
      const mutableUser = asMutablePlatformUser(user);
      if (user.status === "BANNED") throw new MockHttpError(409, "USER_BANNED", "This user is banned. Unban first.");
      if (user.status === "ACTIVE") mutableUser.status = "WARNED";
      const policy = readOptionalTrimmedString(body, "policy", 80) ?? "Community guidelines";
      if (body.addStrike === true) {
        const extras = readUserExtrasForPeople(user.id);
        extras.strikes.unshift({ id: `stk_${user.id}_${Date.now().toString(36)}`, policy, reason, source: "MANUAL", issuedAt: readIsoNow(), expiresAt: readIsoTimeOffset(90 * 1440), issuedByName: request.principal?.name ?? "Admin" });
        mutableUser.strikeCount = extras.strikes.length;
      }
      return { policy, strikeAdded: body.addStrike === true };
    });
  });

  registerMockRoute("POST", "/admin/users/:userId/suspend", (request) => {
    requireMockPermission(request, "users:suspend");
    return changeUserStatus(request, "user.suspended", (user, body, reason) => {
      if (user.status === "BANNED") throw new MockHttpError(409, "USER_BANNED", "This user is banned. Unban first.");
      const durationDays = readDurationInDays(body, false) ?? 1;
      asMutablePlatformUser(user).status = "SUSPENDED";
      const extras = readUserExtrasForPeople(user.id);
      extras.restriction = { kind: "SUSPENSION", reason, startedAt: readIsoNow(), endsAt: readIsoTimeOffset(durationDays * 1440) };
      extras.sessions = [];
      notifyUser(user, "Your account is suspended", `Your account is suspended for ${durationDays} days. Reason: ${reason}. You can appeal from the app.`);
      return { durationDays, userNotified: true, deletionClock: "120 days (stops on reinstatement)" };
    });
  });

  registerMockRoute("POST", "/admin/users/:userId/reinstate", (request) => {
    requireMockPermission(request, "users:suspend");
    return changeUserStatus(request, "user.reinstated", (user) => {
      if (user.status !== "SUSPENDED" && user.status !== "WARNED") throw new MockHttpError(409, "INVALID_STATUS", "Only suspended or warned users can be reinstated. Use unban for banned users.");
      asMutablePlatformUser(user).status = "ACTIVE";
      readUserExtrasForPeople(user.id).restriction = null;
      return {};
    });
  });

  registerMockRoute("POST", "/admin/users/:userId/ban", (request) => {
    requireMockPermission(request, "users:ban");
    requireMockStepUp(request);
    return changeUserStatus(request, "user.banned", (user, body, reason) => {
      if (user.status === "BANNED") throw new MockHttpError(409, "ALREADY_BANNED", "This user is already banned.");
      const durationDays = readDurationInDays(body, true);
      asMutablePlatformUser(user).status = "BANNED";
      const extras = readUserExtrasForPeople(user.id);
      extras.restriction = { kind: "BAN", reason, startedAt: readIsoNow(), endsAt: durationDays === null ? null : readIsoTimeOffset(durationDays * 1440) };
      extras.sessions = [];
      const blockedSignups = durationDays === null ? blockSignupIdentifiers(user) : [];
      notifyUser(user, "Your account was closed", `Your account was banned. Reason: ${reason}.`);
      return { duration: durationDays === null ? "PERMANENT" : `${durationDays} days`, blockedSignups, userNotified: true };
    });
  });

  registerMockRoute("POST", "/admin/users/:userId/unban", (request) => {
    requireMockPermission(request, "users:ban");
    requireMockStepUp(request);
    return changeUserStatus(request, "user.unbanned", (user) => {
      if (user.status !== "BANNED") throw new MockHttpError(409, "NOT_BANNED", "This user is not banned.");
      asMutablePlatformUser(user).status = "ACTIVE";
      readUserExtrasForPeople(user.id).restriction = null;
      clearSignupBlocks(user.id);
      return {};
    });
  });

  registerMockRoute("POST", "/admin/users/:userId/force-logout", (request) => {
    requireMockPermission(request, "users:moderate");
    return changeUserStatus(request, "user.sessions_revoked", (user, body) => {
      const extras = readUserExtrasForPeople(user.id);
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
      if (sessionId && !extras.sessions.some((session) => session.id === sessionId)) throw new MockHttpError(404, "NOT_FOUND", "Session was not found.");
      extras.sessions = sessionId ? extras.sessions.filter((session) => session.id !== sessionId) : [];
      return { revokedSessionId: sessionId ?? "ALL" };
    });
  });
}
