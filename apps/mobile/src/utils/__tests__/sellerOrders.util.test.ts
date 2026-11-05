import { isSellerOrderIncludedInFilter, sellerOrderFundsRemainHeld, sellerOrderNeedsShipment } from "@/utils/sellerOrders.util";

describe("seller order filters", () => {
  it.each(["paid", "new", "processing", "ready"] as const)("includes %s in To ship", (status) => {
    expect(isSellerOrderIncludedInFilter(status, "pending")).toBe(true);
  });

  it.each(["shipped", "delivered", "completed", "cancelled", "refunded", "returned", "disputed"] as const)("does not include %s in To ship", (status) => {
    expect(isSellerOrderIncludedInFilter(status, "pending")).toBe(false);
  });

  it("preserves exact-status filters and all", () => {
    expect(isSellerOrderIncludedInFilter("processing", "processing")).toBe(true);
    expect(isSellerOrderIncludedInFilter("new", "processing")).toBe(false);
    expect(isSellerOrderIncludedInFilter("new", "all")).toBe(true);
  });

  it.each(["paid", "new", "processing", "ready"] as const)("offers shipment for %s", (status) => {
    expect(sellerOrderNeedsShipment(status)).toBe(true);
  });

  it("keeps escrow disclosure while awaiting shipment and through delivery, but not after completion", () => {
    expect(sellerOrderFundsRemainHeld("new")).toBe(true);
    expect(sellerOrderFundsRemainHeld("shipped")).toBe(true);
    expect(sellerOrderFundsRemainHeld("delivered")).toBe(true);
    expect(sellerOrderFundsRemainHeld("completed")).toBe(false);
  });
});
