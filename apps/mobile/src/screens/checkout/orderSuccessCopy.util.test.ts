import { ORDER_SUCCESS_DESCRIPTION, ORDER_SUCCESS_SHOPPING_ROUTE } from "./orderSuccessCopy.util";

describe("order success copy", () => {
  it("does not promise escrow for direct-payment or non-Nigeria orders", () => {
    expect(ORDER_SUCCESS_DESCRIPTION).toContain("payment has been confirmed");
    expect(ORDER_SUCCESS_DESCRIPTION).toContain("any payment-protection information available");
    expect(ORDER_SUCCESS_DESCRIPTION).not.toContain("In Nigeria");
    expect(ORDER_SUCCESS_DESCRIPTION).not.toContain("held by our licensed payment partner");
    expect(ORDER_SUCCESS_DESCRIPTION).not.toContain("3 days after delivery");
  });

  it("continues at the existing Mart search route", () => {
    expect(ORDER_SUCCESS_SHOPPING_ROUTE).toEqual({
      name: "Search",
      params: { scope: "mart", scopeLabel: "Mart" },
    });
  });
});
