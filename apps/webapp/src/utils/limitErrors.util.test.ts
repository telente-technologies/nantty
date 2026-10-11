import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeLimitError } from "./limitErrors.util";

describe("limit error copy", () => {
  it("tells the buyer how much wallet spend is left today", () => {
    const text = describeLimitError("WALLET_DAILY_LIMIT", { tier: "basic", remaining: { amountMinor: 1_500_000, currency: "NGN" }, limit: { amountMinor: 5_000_000, currency: "NGN" } });
    assert.match(text ?? "", /15,000/);
    assert.match(text ?? "", /today/);
    assert.match(describeLimitError("WALLET_DAILY_LIMIT", { remaining: { amountMinor: 0, currency: "NGN" }, limit: { amountMinor: 5_000_000, currency: "NGN" } }) ?? "", /50,000/);
  });

  it("asks large orders to contact support and states the cap", () => {
    const text = describeLimitError("PAYMENT_AMOUNT_OUT_OF_RANGE", { reason: "contactSupportForLargeOrders", maximum: { amountMinor: 500_000_000, currency: "NGN" } });
    assert.match(text ?? "", /Contact support/);
    assert.match(text ?? "", /5,000,000/);
    assert.match(describeLimitError("PAYMENT_AMOUNT_OUT_OF_RANGE", { maximum: { amountMinor: 50_000_000, currency: "NGN" } }) ?? "", /500,000/);
  });

  it("explains the seller debt block without touching existing orders, and ignores other codes", () => {
    assert.match(describeLimitError("SELLER_DEBT_LIMIT", null) ?? "", /aren't affected/);
    assert.match(describeLimitError("SELLER_DEBT_LIMIT", { audience: "buyer" }) ?? "", /This seller can't take new orders/);
    assert.equal(describeLimitError("VERIFICATION_REQUIRED", null), null);
  });
});
