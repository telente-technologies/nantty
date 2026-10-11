


import { describeLimitError } from "../limitErrors.util";

describe("limit error copy", () => {
  it("tells the buyer how much wallet spend is left today", () => {
    const text = describeLimitError("WALLET_DAILY_LIMIT", { tier: "basic", remaining: { amountMinor: 1_500_000, currency: "NGN" }, limit: { amountMinor: 5_000_000, currency: "NGN" } });
    expect(text ?? "").toMatch(/15,000/);
    expect(text ?? "").toMatch(/today/);
    expect(describeLimitError("WALLET_DAILY_LIMIT", { remaining: { amountMinor: 0, currency: "NGN" }, limit: { amountMinor: 5_000_000, currency: "NGN" } }) ?? "").toMatch(/50,000/);
  });

  it("asks large orders to contact support and states the cap", () => {
    const text = describeLimitError("PAYMENT_AMOUNT_OUT_OF_RANGE", { reason: "contactSupportForLargeOrders", maximum: { amountMinor: 500_000_000, currency: "NGN" } });
    expect(text ?? "").toMatch(/Contact support/);
    expect(text ?? "").toMatch(/5,000,000/);
    expect(describeLimitError("PAYMENT_AMOUNT_OUT_OF_RANGE", { maximum: { amountMinor: 50_000_000, currency: "NGN" } }) ?? "").toMatch(/500,000/);
  });

  it("explains the seller debt block without touching existing orders, and ignores other codes", () => {
    expect(describeLimitError("SELLER_DEBT_LIMIT", null) ?? "").toMatch(/aren't affected/);
    expect(describeLimitError("SELLER_DEBT_LIMIT", { audience: "buyer" }) ?? "").toMatch(/This seller can't take new orders/);
    expect(describeLimitError("VERIFICATION_REQUIRED", null)).toBeNull();
  });
});
