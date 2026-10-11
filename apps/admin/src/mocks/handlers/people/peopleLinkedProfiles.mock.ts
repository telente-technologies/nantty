import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failValidation, readEnumValue, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { LinkedProfileItem, LinkedProfilesSummary } from "@/types/linkedProfiles.type";

import { findPlatformUserForPeopleOrFail } from "./peopleStore.mock";

type MutableItem = { -readonly [Key in keyof LinkedProfileItem]: LinkedProfileItem[Key] };

function readStore(): Map<string, MutableItem[]> {
  return readMockAreaStore<Map<string, MutableItem[]>>("people:linkedProfiles", () => {
    const store = new Map<string, MutableItem[]>();
    readMockDatabase().platformUsers.forEach((user, index) => {
      if (!user.isSeller) return;
      const items: MutableItem[] = [{ kind: "store", profileId: `lp_store_${user.id}`, storeId: `st_${user.id}`, status: "active", holdReason: null, name: user.displayName, handle: user.username, showsMart: true }];
      if (index === 0) items.push({ kind: "business", profileId: `lp_business_${user.id}`, storeId: null, status: "held", holdReason: "Your account has more profiles than the rule allows. Choose which to keep.", name: `${user.displayName} Foundation`, handle: `${user.username}.foundation`, showsMart: false });
      store.set(user.id, items);
    });
    return store;
  });
}

function summaryOf(userId: string): LinkedProfilesSummary {
  const items = readStore().get(userId) ?? [];
  const active = items.filter((item) => item.status === "active");
  const hasSlot = active.some((item) => item.kind !== "brand");
  return { accountId: userId, items, canCreate: { store: !hasSlot, business: !hasSlot, brand: !active.some((item) => item.kind === "brand") }, choiceRequired: items.some((item) => item.status === "held") };
}

const readers = ["users:read", "support:tickets", "users:moderate"] as const;

export function registerPeopleLinkedProfileMockHandlers(): void {
  registerMockRoute("GET", "/admin/users/:userId/linked-profiles", (request) => {
    requireMockPermission(request, ...readers);
    return respondWithJson(200, summaryOf(findPlatformUserForPeopleOrFail(request.params.userId).id));
  });

  registerMockRoute("GET", "/admin/linked-profiles/conflicts", (request) => {
    requireMockPermission(request, ...readers);
    return respondWithJson(200, { data: [...readStore().keys()].map(summaryOf).filter((summary) => summary.choiceRequired) });
  });

  registerMockRoute("POST", "/admin/users/:userId/linked-profiles/convert", (request) => {
    requireMockPermission(request, "users:moderate");
    requireMockStepUp(request);
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const profileId = readRequiredTrimmedString(body, "profileId", 64);
    const toKind = readEnumValue(body, "toKind", ["store", "business"] as const);
    const item = (readStore().get(user.id) ?? []).find((candidate) => candidate.profileId === profileId && candidate.kind !== "brand");
    if (!item) failValidation("profileId", "Choose one of this account's Store or Business pages.");
    if (item.kind === toKind) failConflict("NO_CHANGE", `That profile is already a ${toKind}.`);
    if (toKind === "business" && item.storeId) failConflict("STORE_STILL_OPEN", "Close the store before turning it into a business page.");
    const before = item.kind;
    item.kind = toKind;
    item.showsMart = toKind === "store";
    recordMockAuditEntry(request, { action: "linked_profiles.converted", area: "users", target: { type: "user", id: user.id, label: `@${user.username}` }, reason, before: { profileId, kind: before }, after: { profileId, kind: toKind } });
    return respondWithJson(200, summaryOf(user.id));
  });

  registerMockRoute("POST", "/admin/users/:userId/linked-profiles/resolve", (request) => {
    requireMockPermission(request, "users:moderate");
    requireMockStepUp(request);
    const user = findPlatformUserForPeopleOrFail(request.params.userId);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const keep = Array.isArray(body["keep"]) ? body["keep"].map(String) : failValidation("keep", "List the profiles to keep.");
    const items = readStore().get(user.id) ?? [];
    if (keep.some((id) => !items.some((item) => item.profileId === id))) failValidation("keep", "Only list this account's linked profiles.");
    const kept = items.filter((item) => keep.includes(item.profileId));
    if (kept.filter((item) => item.kind !== "brand").length > 1) failConflict("PROFILE_LIMIT_STORE_OR_BUSINESS", "Keep one Store or one Business page, not both.");
    if (kept.filter((item) => item.kind === "brand").length > 1) failConflict("PROFILE_LIMIT_ONE_BRAND", "Keep one Brand.");
    const before = items.map((item) => ({ profileId: item.profileId, status: item.status }));
    for (const item of items) {
      item.status = keep.includes(item.profileId) ? "active" : "retired";
      item.holdReason = item.status === "active" ? null : "Not kept when choosing profiles.";
    }
    recordMockAuditEntry(request, { action: "linked_profiles.resolved", area: "users", target: { type: "user", id: user.id, label: `@${user.username}` }, reason, before, after: items.map((item) => ({ profileId: item.profileId, status: item.status })) });
    return respondWithJson(200, summaryOf(user.id));
  });
}
