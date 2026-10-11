import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PayoutOnboardingSummary } from "@/types/payoutOnboarding.type";

import { describePayoutSetupCard } from "./payoutSetupCard.util";

const base: PayoutOnboardingSummary = { role: "seller", status: "not_started", currentStep: "identity", completedSteps: [], accountStatus: null, pendingWithdrawable: null, withdrawalsEnabled: false, firstEarningsUnlockAt: null };

describe("payout setup card", () => {
  it("hides once verified and uses mobile's copy otherwise", () => {
    assert.equal(describePayoutSetupCard({ ...base, status: "verified" }), null);
    assert.equal(describePayoutSetupCard(base)?.title, "Set up payouts to withdraw your sales");
    assert.equal(describePayoutSetupCard({ ...base, role: "creator" })?.title, "Set up payouts to receive gift earnings");
    assert.equal(describePayoutSetupCard({ ...base, status: "action_needed", completedSteps: ["identity"] })?.actionLabel, "See what's needed");
  });

  it("counts down to the first earnings unlock for sellers", () => {
    const now = Date.parse("2026-10-10T10:00:00Z");
    assert.match(describePayoutSetupCard({ ...base, firstEarningsUnlockAt: "2026-10-11T12:30:00Z" }, undefined, now)?.body ?? "", /in 26h 30m/);
  });
});
