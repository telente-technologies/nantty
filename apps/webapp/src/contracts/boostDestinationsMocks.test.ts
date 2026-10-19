import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { getSignedInMockUser, me, mockSession } from "@/mocks/fixtures.mock";
import type { BoostOptions, CreatedBoost } from "@/types/boost.type";
import type { MyStoreSummary } from "@/types/commerce.type";
import type { Page } from "@/types";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown) => dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });

const promoteRequest = async (destinationType: "profile" | "store", targetId: string, goal: string) => {
  const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
  return { destinationType, targetId, goal, audience: { mode: "automatic" }, dailyBudget: options.suggestedDailyBudgets[0], durationDays: 1, paymentMethod: "card" };
};

describe("boost destination mocks", () => {
  it("promotes your own profile with a profile-visits goal", async () => {
    mockSession.signedInUserId = me.id;
    const created = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await promoteRequest("profile", me.id, "profile_visits"));
    assert.equal(created.boost.destinationType, "profile");
    assert.equal(created.boost.targetId, me.id);
    assert.equal(created.boost.postId, "");
  });

  it("refuses someone else's profile or store", async () => {
    mockSession.signedInUserId = me.id;
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await promoteRequest("profile", "u_someone", "profile_visits"))))?.code, "DESTINATION_NOT_OWNED");
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await promoteRequest("store", "st_not_mine", "store_visits"))))?.code, "DESTINATION_NOT_OWNED");
  });

  it("lists the stores you manage for the Promote store entry", async () => {
    mockSession.signedInUserId = me.id;
    const page = await call<Page<MyStoreSummary> | readonly MyStoreSummary[]>("GET", "/api/v1/seller/stores/mine");
    const stores = Array.isArray(page) ? page : (page as Page<MyStoreSummary>).data;
    const storeId = getSignedInMockUser().storeId;
    assert.equal(stores.length, storeId ? 1 : 0);
    if (storeId) assert.deepEqual(stores[0], { storeId, storeName: "Your store", role: "owner", isCurrent: true });
  });
});
