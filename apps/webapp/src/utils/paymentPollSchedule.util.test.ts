import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextPaymentPollDelay } from "./paymentPollSchedule.util";

const pending = (result: { status: string }) => result.status === "pending";
const transient = (error: unknown) => error === "network";

describe("payment poll schedule", () => {
  it("keeps polling a pending payment until the attempt budget is spent", () => {
    assert.equal(nextPaymentPollDelay({ data: { status: "pending" }, error: null, dataUpdateCount: 3, errorUpdateCount: 0 }, pending, transient, 3000, 40), 3000);
    assert.equal(nextPaymentPollDelay({ data: { status: "succeeded" }, error: null, dataUpdateCount: 1, errorUpdateCount: 0 }, pending, transient, 3000, 40), false);
  });

  it("stops after the budget when every check fails, instead of calling the verify endpoint forever", () => {
    assert.equal(nextPaymentPollDelay({ data: undefined, error: "network", dataUpdateCount: 0, errorUpdateCount: 39 }, pending, transient, 3000, 40), 3000);
    assert.equal(nextPaymentPollDelay({ data: undefined, error: "network", dataUpdateCount: 0, errorUpdateCount: 40 }, pending, transient, 3000, 40), false);
  });

  it("stops at once on a hard failure such as a missing payment", () => {
    assert.equal(nextPaymentPollDelay({ data: undefined, error: "notFound", dataUpdateCount: 0, errorUpdateCount: 1 }, pending, transient, 3000, 40), false);
  });
});
