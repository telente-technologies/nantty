import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeWalletDailyLimit } from "./walletLimits.util";

const naira = (amountMinor: number) => ({ amountMinor, currency: "NGN" });

describe("wallet daily limit line", () => {
  it("shows the user's own remaining amount and tier", () => {
    const text = describeWalletDailyLimit({ tier: "basic", dailyLimit: naira(5_000_000), spentToday: naira(2_000_000), remainingToday: naira(3_000_000), resetsAt: "2026-10-11T23:00:00Z" }) ?? "";
    assert.match(text, /30,000 more/);
    assert.match(text, /50,000/);
    assert.match(text, /basic tier/);
  });

  it("says when today's limit is used up, and falls back when the server sent nothing", () => {
    assert.match(describeWalletDailyLimit({ tier: "mid", dailyLimit: naira(20_000_000), spentToday: naira(20_000_000), remainingToday: naira(0), resetsAt: "" }) ?? "", /used today's/);
    assert.equal(describeWalletDailyLimit(undefined), null);
  });
});
