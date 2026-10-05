import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failNotFound, failValidation, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import type { UsernameWithholdResult } from "@/types/peopleUsers.type";
import type { ConfusableCollision, ConfusablePreview, ReservedUsernameEntry, ReservedUsernameKind, ReservedUsernameMatchKind, ReservedUsernameRule } from "@/types/usernames.type";
import { computeConfusableSkeletonForUsername, convertGlobPatternToSafeRegularExpression, generateReplacementUsername, normalizeUsernameForComparison } from "@/utils/usernameConfusables.util";

import { buildUserDetailResponse } from "./peopleUsers.mock";
import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readPeopleMockStore, readUserExtrasForPeople } from "./peopleStore.mock";

const reservedMatchKinds: readonly ReservedUsernameMatchKind[] = ["exact", "prefix", "contains", "brand"];
const reservedPageSize = 50;

function presentReservedRule(entry: ReservedUsernameEntry): ReservedUsernameRule {
  const term = entry.value.replace(/\*/g, "");
  const matchKind: ReservedUsernameMatchKind = entry.kind === "PREFIX" ? "prefix" : entry.kind === "PATTERN" ? "contains" : entry.category === "BRAND" ? "brand" : "exact";
  return { id: entry.id, term, matchKind, createdAt: entry.addedAt };
}

function convertRuleToStoreEntry(term: string, matchKind: ReservedUsernameMatchKind, addedByName: string): ReservedUsernameEntry {
  const kind: ReservedUsernameKind = matchKind === "prefix" ? "PREFIX" : matchKind === "contains" ? "PATTERN" : "EXACT";
  const value = kind === "PREFIX" ? `${term}*` : kind === "PATTERN" ? `*${term}*` : term;
  return { id: createMockId("rsv"), value, kind, category: matchKind === "brand" ? "BRAND" : "SYSTEM", note: null, addedAt: readIsoNow(), addedByName };
}

export function createUnusedReplacementUsername(): string {
  const takenUsernames = new Set(readMockDatabase().platformUsers.map((user) => user.username));
  let candidate = generateReplacementUsername();
  while (takenUsernames.has(candidate)) candidate = generateReplacementUsername();
  return candidate;
}

export function findReservedCollisionsForCandidate(candidate: string): ConfusableCollision[] {
  const normalized = normalizeUsernameForComparison(candidate);
  const skeleton = computeConfusableSkeletonForUsername(candidate);
  const collisions: ConfusableCollision[] = [];
  for (const entry of readPeopleMockStore().reservedUsernames) {
    const entryValue = normalizeUsernameForComparison(entry.value);
    if (entry.kind === "EXACT") {
      if (entryValue === normalized) collisions.push({ entryId: entry.id, value: entry.value, kind: entry.kind, category: entry.category, matchedBy: "EXACT" });
      else if (computeConfusableSkeletonForUsername(entryValue) === skeleton) collisions.push({ entryId: entry.id, value: entry.value, kind: entry.kind, category: entry.category, matchedBy: "SKELETON" });
    } else if (entry.kind === "PREFIX") {
      const prefix = entryValue.replace(/\*+$/, "");
      if (normalized.startsWith(prefix) || skeleton.startsWith(computeConfusableSkeletonForUsername(prefix))) collisions.push({ entryId: entry.id, value: entry.value, kind: entry.kind, category: entry.category, matchedBy: "PREFIX" });
    } else if (convertGlobPatternToSafeRegularExpression(entryValue).test(normalized) || convertGlobPatternToSafeRegularExpression(entryValue).test(skeleton)) {
      collisions.push({ entryId: entry.id, value: entry.value, kind: entry.kind, category: entry.category, matchedBy: "PATTERN" });
    }
  }
  return collisions;
}

function buildNotificationPreview(oldUsername: string, newUsername: string, reason: string) {
  return { channel: "IN_APP_AND_EMAIL" as const, title: "Your username was changed", body: `Your username @${oldUsername} is no longer available to you. Your account now uses @${newUsername}. You can pick a new username in Settings. Reason: ${reason}` };
}

export function registerPeopleUsernameMockHandlers(): void {
  registerMockRoute("POST", "/admin/users/:userId/username/withhold", (request) => {
    const principal = requireMockPermission(request, "usernames:manage");
    requireMockStepUp(request);
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const store = readPeopleMockStore();
    if (store.withheldUsernames.some((entry) => entry.originalOwnerId === user.id)) failConflict("ALREADY_WITHHELD", "This user already has a withheld username. Restore or reassign it first.");
    const oldUsername = user.username;
    const newUsername = createUnusedReplacementUsername();
    asMutablePlatformUser(user).username = newUsername;
    const withheldUsername = { username: oldUsername, originalOwnerId: user.id, originalOwnerDisplayName: user.displayName, withheldAt: readIsoNow(), withheldByName: principal.name, reason };
    store.withheldUsernames.unshift(withheldUsername);
    readUserExtrasForPeople(user.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: oldUsername, toUsername: newUsername, kind: "WITHHELD", changedAt: readIsoNow(), changedByName: principal.name, reason });
    const notification = buildNotificationPreview(oldUsername, newUsername, reason);
    recordMockAuditEntry(request, { action: "username.withheld", area: "usernames", target: { type: "user", id: user.id, label: `@${oldUsername}` }, reason, before: { username: oldUsername }, after: { username: newUsername, withheld: oldUsername, notificationSent: true } });
    const result: UsernameWithholdResult = { user: presentPlatformUserSummary(user), withheldUsername, assignedUsername: newUsername, notification };
    return respondWithJson(200, result);
  });

  registerMockRoute("POST", "/admin/users/:userId/username/reclaim", (request) => {
    const principal = requireMockPermission(request, "usernames:manage");
    requireMockStepUp(request);
    const owner = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const mode = readEnumValue(body, "mode", ["RESTORE_TO_OWNER", "ASSIGN_TO_CLAIMANT"] as const);
    const store = readPeopleMockStore();
    const withheld = store.withheldUsernames.find((entry) => entry.originalOwnerId === owner.id);
    if (!withheld) failNotFound("Withheld username for this user");
    const recipient = mode === "RESTORE_TO_OWNER" ? owner : findPlatformUserForPeopleOrFail(readRequiredTrimmedString(body, "claimantUserId", 64));
    if (mode === "ASSIGN_TO_CLAIMANT" && recipient.id === owner.id) failValidation("claimantUserId", "Choose a different account than the original owner.");
    if (mode === "ASSIGN_TO_CLAIMANT" && recipient.verification?.status !== "VERIFIED") failValidation("claimantUserId", "Only verified accounts can receive a reclaimed username.");
    const previousRecipientUsername = recipient.username;
    asMutablePlatformUser(recipient).username = withheld.username;
    store.withheldUsernames.splice(store.withheldUsernames.indexOf(withheld), 1);
    readUserExtrasForPeople(recipient.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: previousRecipientUsername, toUsername: withheld.username, kind: mode === "RESTORE_TO_OWNER" ? "RESTORED" : "RECEIVED_FROM_RECLAIM", changedAt: readIsoNow(), changedByName: principal.name, reason });
    if (mode === "ASSIGN_TO_CLAIMANT") readUserExtrasForPeople(owner.id).usernameHistory.unshift({ id: createMockId("unh"), fromUsername: withheld.username, toUsername: owner.username, kind: "ASSIGNED_TO_CLAIMANT", changedAt: readIsoNow(), changedByName: principal.name, reason });
    recordMockAuditEntry(request, { action: mode === "RESTORE_TO_OWNER" ? "username.restored" : "username.reassigned", area: "usernames", target: { type: "user", id: owner.id, label: `@${withheld.username}` }, reason, before: { withheld: withheld.username, recipientUsername: previousRecipientUsername }, after: { recipientId: recipient.id, recipientUsername: withheld.username } });
    return respondWithJson(200, buildUserDetailResponse(owner));
  });

  registerMockRoute("GET", "/admin/usernames/withheld", (request) => {
    requireMockPermission(request, "usernames:manage", "reserved-usernames:manage");
    return respondWithJson(200, { items: readPeopleMockStore().withheldUsernames });
  });

  registerMockRoute("GET", "/admin/usernames/confusables", (request) => {
    requireMockPermission(request, "usernames:manage", "reserved-usernames:manage");
    const candidate = (request.query.get("candidate") ?? "").slice(0, 60);
    if (!candidate.trim()) failValidation("candidate", "Enter a username to check.");
    const normalized = normalizeUsernameForComparison(candidate);
    const takenBy = readMockDatabase().platformUsers.find((user) => user.username === normalized || computeConfusableSkeletonForUsername(user.username) === computeConfusableSkeletonForUsername(candidate));
    const preview: ConfusablePreview = {
      candidate,
      normalized,
      skeleton: computeConfusableSkeletonForUsername(candidate),
      collisions: findReservedCollisionsForCandidate(candidate),
      takenByUserId: takenBy?.id ?? null,
      takenByUsername: takenBy?.username ?? null,
      isWithheld: readPeopleMockStore().withheldUsernames.some((entry) => entry.username === normalized),
    };
    return respondWithJson(200, preview);
  });

  registerMockRoute("GET", "/admin/usernames/reserved", (request) => {
    requireMockPermission(request, "reserved-usernames:manage");
    const offset = Math.max(0, Number(request.query.get("cursor") ?? 0) || 0);
    const rules = readPeopleMockStore().reservedUsernames.map(presentReservedRule);
    const page = rules.slice(offset, offset + reservedPageSize);
    return respondWithJson(200, { data: page, nextCursor: offset + reservedPageSize < rules.length ? String(offset + reservedPageSize) : null });
  });

  registerMockRoute("POST", "/admin/usernames/reserved", (request) => {
    const principal = requireMockPermission(request, "reserved-usernames:manage");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const matchKind = readEnumValue(body, "matchKind", reservedMatchKinds);
    const term = readRequiredTrimmedString(body, "term", 30, 2).toLowerCase();
    if (!/^[a-z0-9._]{2,30}$/.test(term)) failValidation("term", "Use 2–30 letters, numbers, dots or underscores.");
    const store = readPeopleMockStore();
    const entry = convertRuleToStoreEntry(term, matchKind, principal.name);
    if (store.reservedUsernames.some((existing) => existing.value === entry.value && existing.kind === entry.kind)) throw new MockHttpError(422, "RULE_EXISTS", "That name is already reserved.");
    store.reservedUsernames.unshift(entry);
    recordMockAuditEntry(request, { action: "reserved_username.added", area: "usernames", target: { type: "reservedUsername", id: entry.id, label: term }, reason: null, before: null, after: { term, matchKind } });
    const { createdAt: _createdAt, ...created } = presentReservedRule(entry);
    return respondWithJson(201, created);
  });

  registerMockRoute("DELETE", "/admin/usernames/reserved/:ruleId", (request) => {
    requireMockPermission(request, "reserved-usernames:manage");
    requireMockStepUp(request);
    const store = readPeopleMockStore();
    const index = store.reservedUsernames.findIndex((entry) => entry.id === request.params.ruleId);
    if (index < 0) throw new MockHttpError(404, "NOT_FOUND", "Reserved entry was not found.");
    const [removed] = store.reservedUsernames.splice(index, 1);
    recordMockAuditEntry(request, { action: "reserved_username.removed", area: "usernames", target: { type: "reservedUsername", id: removed!.id, label: removed!.value }, reason: null, before: { value: removed!.value, kind: removed!.kind }, after: null });
    return respondWithNoContent();
  });
}
