import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failValidation, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";

import { createUnusedReplacementUsername } from "./peopleUsernames.mock";
import { buildUserDetailResponse } from "./peopleUsers.mock";
import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readUserExtrasForPeople } from "./peopleStore.mock";

const restrictableFeatures = ["POSTING", "COMMENTING", "MESSAGING", "SELLING", "GOING_LIVE"] as const;
const legalRetentionYears = 7;

interface UserActionStore {
  readonly notices: { id: string; userId: string; title: string; body: string; sentAt: string }[];
  readonly blockedSignups: { id: string; userId: string; kind: "EMAIL" | "DEVICE"; fingerprint: string; blockedAt: string }[];
  readonly heldUsernames: { username: string; releasedAt: string; availableAt: string }[];
  readonly deletions: { userId: string; deletedAt: string; deletedByName: string; anonymizedRecords: Record<string, number>; retainedUntil: string }[];
}

function readStore(): UserActionStore {
  return readMockAreaStore<UserActionStore>("people:userActions", () => ({ notices: [], blockedSignups: [], heldUsernames: [{ username: "mercy.styles", releasedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), availableAt: new Date(Date.now() + 100 * 86_400_000).toISOString() }, { username: "old.tunde", releasedAt: new Date(Date.now() - 130 * 86_400_000).toISOString(), availableAt: new Date(Date.now() - 10 * 86_400_000).toISOString() }], deletions: [] }));
}

const holdDays = 120;

export function holdReleasedUsername(username: string): void {
  const releasedAt = readIsoNow();
  readStore().heldUsernames.unshift({ username, releasedAt, availableAt: new Date(Date.now() + holdDays * 86_400_000).toISOString() });
}

function readHold(username: string) {
  const entry = readStore().heldUsernames.find((candidate) => candidate.username === username);
  return entry ? { ...entry, isHeld: Date.parse(entry.availableAt) > Date.now() } : null;
}

export function notifyUser(user: MockPlatformUserRecord, title: string, body: string): void {
  readStore().notices.unshift({ id: createMockId("ntc"), userId: user.id, title, body, sentAt: readIsoNow() });
}

function fingerprintOf(value: string): string {
  let hash = 5381;
  for (const character of value) hash = (hash * 33) ^ character.charCodeAt(0);
  return `h_${(hash >>> 0).toString(16)}`;
}

export function blockSignupIdentifiers(user: MockPlatformUserRecord): string[] {
  const store = readStore();
  const identifiers = [{ kind: "EMAIL" as const, value: user.personalData.email }, { kind: "DEVICE" as const, value: `device-of-${user.id}` }].filter((item) => item.value);
  for (const item of identifiers) store.blockedSignups.unshift({ id: createMockId("blk"), userId: user.id, kind: item.kind, fingerprint: fingerprintOf(item.value), blockedAt: readIsoNow() });
  return identifiers.map((item) => item.kind);
}

export function clearSignupBlocks(userId: string): void {
  const store = readStore();
  store.blockedSignups.splice(0, store.blockedSignups.length, ...store.blockedSignups.filter((entry) => entry.userId !== userId));
}

const target = (user: MockPlatformUserRecord) => ({ type: "user", id: user.id, label: `@${user.username}` });

export function registerPeopleUserActionMockHandlers(): void {
  registerMockRoute("POST", "/admin/users/:userId/restrict", (request) => {
    requireMockPermission(request, "users:restrict");
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const features = Array.isArray(body.features) ? [...new Set(body.features.filter((feature): feature is (typeof restrictableFeatures)[number] => (restrictableFeatures as readonly unknown[]).includes(feature)))] : [];
    if (features.length === 0) failValidation("features", "Choose at least one feature to limit.");
    const durationDays = body.durationDays;
    if (typeof durationDays !== "number" || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) failValidation("durationDays", "Choose a duration between 1 and 90 days.");
    if (user.status === "BANNED" || user.status === "DELETED") throw new MockHttpError(409, "USER_UNAVAILABLE", `This account is ${user.status.toLowerCase()}.`);
    const extras = readUserExtrasForPeople(user.id);
    const before = { restriction: extras.restriction };
    extras.restriction = { kind: "FEATURE_RESTRICTION", features, reason, startedAt: readIsoNow(), endsAt: readIsoTimeOffset(durationDays * 1440) };
    notifyUser(user, "Some features are limited", `For ${durationDays} days you cannot use: ${features.join(", ").toLowerCase().replace(/_/g, " ")}. Reason: ${reason}`);
    recordMockAuditEntry(request, { action: "user.restricted", area: "users", target: target(user), reason, before, after: { restriction: extras.restriction, userNotified: true } });
    return respondWithJson(200, buildUserDetailResponse(user));
  });

  registerMockRoute("POST", "/admin/users/:userId/delete", (request) => {
    const principal = requireMockPermission(request, "users:delete");
    requireMockStepUp(request);
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    if (readRequiredTrimmedString(body, "confirmUsername", 60) !== user.username) failValidation("confirmUsername", "Type the exact username to confirm.");
    if (user.status === "DELETED") failConflict("ALREADY_DELETED", "This account is already deleted.");
    const extras = readUserExtrasForPeople(user.id);
    if (extras.wallet.pendingWithdrawalCount > 0) throw new MockHttpError(409, "PENDING_WITHDRAWALS", "Resolve the pending withdrawals before deleting this account.");
    const before = { username: user.username, status: user.status, displayName: user.displayName };
    const anonymizedRecords = { orders: user.isSeller ? 14 : 6, payments: user.isSeller ? 22 : 9, ledgerEntries: user.isSeller ? 51 : 17 };
    const mutable = asMutablePlatformUser(user);
    mutable.username = `deleted_${user.id.slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
    mutable.displayName = "Deleted account";
    mutable.avatarUrl = null;
    mutable.status = "DELETED";
    mutable.verification = null;
    mutable.followerCount = 0;
    mutable.personalData = { email: "", phone: "", legalName: "", dateOfBirth: null };
    extras.restriction = null;
    extras.sessions = [];
    extras.bio = null;
    const retainedUntil = new Date(Date.now() + legalRetentionYears * 365 * 86_400_000).toISOString();
    readStore().deletions.unshift({ userId: user.id, deletedAt: readIsoNow(), deletedByName: principal.name, anonymizedRecords, retainedUntil });
    recordMockAuditEntry(request, { action: "user.deleted", area: "users", target: { type: "user", id: user.id, label: `@${before.username}` }, reason, before, after: { status: "DELETED", removed: ["profile", "posts", "media", "messages"], anonymizedRecords, financialRecordsRetainedUntil: retainedUntil } });
    return respondWithJson(200, { ...buildUserDetailResponse(user), deletion: { removed: ["profile", "posts", "media", "messages"], anonymizedRecords, retainedUntil } });
  });

  registerMockRoute("POST", "/admin/users/:userId/username/reassign", (request) => {
    const principal = requireMockPermission(request, "usernames:reassign");
    requireMockStepUp(request);
    const owner = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const recipientId = readRequiredTrimmedString(body, "recipientUserId", 64);
    if (recipientId === owner.id) failValidation("recipientUserId", "Choose a different account.");
    const recipient = readMockDatabase().platformUsers.find((candidate) => candidate.id === recipientId);
    if (!recipient) failValidation("recipientUserId", "No account has that ID.");
    if (recipient.status === "BANNED" || recipient.status === "DELETED" || owner.status === "DELETED") throw new MockHttpError(409, "USER_UNAVAILABLE", "Banned or deleted accounts cannot take part.");
    const movedUsername = owner.username;
    const recipientOldUsername = recipient.username;
    const ownerNewUsername = createUnusedReplacementUsername();
    holdReleasedUsername(recipientOldUsername);
    asMutablePlatformUser(owner).username = ownerNewUsername;
    asMutablePlatformUser(recipient).username = movedUsername;
    const now = readIsoNow();
    readUserExtrasForPeople(owner.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: movedUsername, toUsername: ownerNewUsername, kind: "REASSIGNED_AWAY", changedAt: now, changedByName: principal.name, reason });
    readUserExtrasForPeople(recipient.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: recipientOldUsername, toUsername: movedUsername, kind: "REASSIGNED_TO", changedAt: now, changedByName: principal.name, reason });
    notifyUser(owner, "Your username was changed", `@${movedUsername} was reassigned. Your account now uses @${ownerNewUsername}. You can choose a new one in Settings. Reason: ${reason}`);
    notifyUser(recipient, "You received a username", `You can now use @${movedUsername}. Your earlier username @${recipientOldUsername} was released.`);
    recordMockAuditEntry(request, { action: "username.reassigned_between_accounts", area: "usernames", target: { type: "user", id: owner.id, label: `@${movedUsername}` }, reason, before: { ownerUsername: movedUsername, recipientUsername: recipientOldUsername }, after: { recipientOldUsernameHeldDays: holdDays, ownerUsername: ownerNewUsername, recipientId: recipient.id, recipientUsername: movedUsername, bothNotified: true, historyKept: true } });
    return respondWithJson(200, buildUserDetailResponse(owner));
  });

  registerMockRoute("GET", "/admin/usernames/held", (request) => {
    requireMockPermission(request, "usernames:reassign", "reserved-usernames:manage");
    return respondWithJson(200, { items: readStore().heldUsernames.map((entry) => ({ ...entry, isHeld: Date.parse(entry.availableAt) > Date.now() })) });
  });

  registerMockRoute("GET", "/admin/usernames/hold", (request) => {
    requireMockPermission(request, "usernames:reassign", "reserved-usernames:manage");
    const username = (request.query.get("username") ?? "").trim().toLowerCase().replace(/^@/, "");
    if (!username) failValidation("username", "Enter a username.");
    return respondWithJson(200, readHold(username) ?? { username, releasedAt: null, availableAt: null, isHeld: false });
  });

  registerMockRoute("POST", "/admin/users/:userId/username/assign-held", (request) => {
    const principal = requireMockPermission(request, "usernames:reassign");
    requireMockStepUp(request);
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const username = readRequiredTrimmedString(body, "username", 30).toLowerCase().replace(/^@/, "");
    if (readMockDatabase().platformUsers.some((candidate) => candidate.username === username)) failConflict("USERNAME_TAKEN", `@${username} belongs to an account right now.`);
    const hold = readHold(username);
    const isBypass = hold?.isHeld === true;
    if (isBypass && body.bypassHold !== true) throw new MockHttpError(409, "USERNAME_HELD", `@${username} is held until ${hold?.availableAt.slice(0, 10)}. Confirm the bypass to assign it now.`);
    const previous = user.username;
    asMutablePlatformUser(user).username = username;
    holdReleasedUsername(previous);
    const heldStore = readStore().heldUsernames;
    heldStore.splice(0, heldStore.length, ...heldStore.filter((entry) => entry.username !== username));
    readUserExtrasForPeople(user.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: previous, toUsername: username, kind: "REASSIGNED_TO", changedAt: readIsoNow(), changedByName: principal.name, reason });
    notifyUser(user, "You received a username", `You can now use @${username}. Your earlier username @${previous} is held for ${holdDays} days.`);
    recordMockAuditEntry(request, { action: isBypass ? "username.assigned_hold_bypassed" : "username.assigned", area: "usernames", target: target(user), reason, before: { username: previous, holdReleasedAt: hold?.releasedAt ?? null, holdAvailableAt: hold?.availableAt ?? null }, after: { username, holdBypassed: isBypass, previousUsernameHeldDays: holdDays } });
    return respondWithJson(200, buildUserDetailResponse(user));
  });
}
