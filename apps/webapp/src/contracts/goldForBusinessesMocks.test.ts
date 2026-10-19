import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { demoFanAccount, me, mockSession } from "@/mocks/fixtures.mock";
import type { GoldForBusinessesQuote, GoldForBusinessesState } from "@/types/goldForBusinesses.type";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown) => dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });
const base = "/api/v1/subscriptions/gold-for-businesses";

describe("gold for all your businesses mocks", () => {
  it("prices three businesses yearly like the owner's worked example", async () => {
    const quote = await call<GoldForBusinessesQuote>("POST", `${base}/quote`, { profileIds: ["bp_ada_foods", "bp_ada_consulting", "bp_ada_logistics"], interval: "year" });
    assert.equal(quote.breakdown.tierBps, 1200);
    assert.equal(quote.breakdown.tierDiscountMinor, 1_296_000);
    assert.equal(quote.breakdown.yearlyExtraDiscountMinor, 475_200);
    assert.deepEqual(quote.total, { amountMinor: 9_028_800, currency: "NGN" });
    const state = await call<GoldForBusinessesState>("GET", base);
    assert.equal(state.premium, true);
    assert.ok(state.businesses.some((business) => business.hasOwnGold));
    const own = state.businesses.find((business) => business.hasOwnGold)!;
    assert.equal((await failureOf(call("POST", `${base}/quote`, { profileIds: [own.profileId], interval: "month" })))?.code, "COMBINED_GOLD_PROFILES_INVALID");
  });

  it("refuses a stale total, then checks out and changes the covered businesses", async () => {
    const quote = await call<GoldForBusinessesQuote>("POST", `${base}/quote`, { profileIds: ["bp_ada_foods"], interval: "year" });
    const stale = await failureOf(call("POST", `${base}/checkout`, { profileIds: ["bp_ada_foods"], interval: "year", expectedTotalMinor: quote.total.amountMinor + 1 }));
    assert.equal(stale?.code, "PRICE_CHANGED");
    const started = await call<{ subscriptionId: string; authorizationUrl: string }>("POST", `${base}/checkout`, { profileIds: ["bp_ada_foods"], interval: "year", expectedTotalMinor: quote.total.amountMinor });
    assert.ok(started.authorizationUrl);
    const change = await call<{ added: string[]; removing: string[] }>("PUT", `${base}/${started.subscriptionId}/profiles`, { profileIds: ["bp_ada_consulting"] });
    assert.deepEqual(change.added, ["bp_ada_consulting"]);
    assert.deepEqual(change.removing, ["bp_ada_foods"]);
    const after = await call<GoldForBusinessesState>("GET", base);
    assert.equal(after.subscription?.coveredProfiles.find((profile) => profile.profileId === "bp_ada_foods")?.coverage, "removing");
  });

  it("needs Blue Premium", async () => {
    mockSession.signedInUserId = demoFanAccount.id;
    try {
      assert.equal((await call<GoldForBusinessesState>("GET", base)).premium, false);
      assert.equal((await failureOf(call("POST", `${base}/quote`, { profileIds: ["bp_ada_foods"], interval: "month" })))?.code, "PREMIUM_REQUIRED");
    } finally {
      mockSession.signedInUserId = me.id;
    }
  });
});
