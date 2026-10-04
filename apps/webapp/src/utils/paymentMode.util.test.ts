import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StoreSummary } from "../types";
import { describeStoreTrust, isDirectPaymentStore, toPaymentModeChoices } from "./paymentMode.util";

const store = (overrides: Partial<StoreSummary> = {}): StoreSummary => ({ id: "s1", name: "Shop", logoUrl: null, rating: 4.5, ratingCount: 10, reviewCount: 10, ...overrides });
const gold = { status: "active", type: "business", color: "gold", tier: "VERIFIED", badgeVisible: true } as const;

describe("payment mode helpers", () => {
  it("offers direct payment only for active gold stores", () => {
    assert.equal(isDirectPaymentStore(store({ verification: gold })), true);
    assert.equal(isDirectPaymentStore(store({ verification: { ...gold, color: "blue" } })), false);
    assert.equal(isDirectPaymentStore(store({ verification: { ...gold, status: "expired" } })), false);
    assert.equal(isDirectPaymentStore(store()), false);
  });

  it("maps choices to the request shape", () => {
    assert.deepEqual(toPaymentModeChoices({ s1: "direct" }), [{ storeId: "s1", paymentMode: "direct" }]);
  });

  it("prefers success rate over rating", () => {
    assert.equal(describeStoreTrust(store({ successRate: 0.973 })), "97% success rate");
    assert.equal(describeStoreTrust(store()), "4.5 rating (10)");
  });
});
