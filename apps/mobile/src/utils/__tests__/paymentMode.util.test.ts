import type { CartSellerGroup } from "@/types";

import { canPayDirectly, describeStoreTrust, directChoicesFor } from "../paymentMode.util";

const group = (storeId: string, store: CartSellerGroup["store"]): CartSellerGroup => ({ storeId, storeName: "Shop", store } as CartSellerGroup);

describe("payment mode helpers", () => {
  it("only verified stores can be paid directly", () => {
    expect(canPayDirectly(group("a", { verified: true }))).toBe(true);
    expect(canPayDirectly(group("b", { verified: false }))).toBe(false);
    expect(canPayDirectly(group("c", null))).toBe(false);
  });

  it("sends choices only for verified stores and defaults to escrow", () => {
    const groups = [group("a", { verified: true }), group("b", { verified: false }), group("c", { verified: true })];
    expect(directChoicesFor(groups, { a: "direct", b: "direct" })).toEqual({ a: "direct", c: "escrow" });
  });

  it("prefers success rate over rating", () => {
    expect(describeStoreTrust(group("a", { successRate: 0.973 }))).toBe("97% success rate");
    expect(describeStoreTrust(group("a", { rating: 4.5, ratingCount: 10 }))).toBe("4.5 rating (10)");
  });
});
