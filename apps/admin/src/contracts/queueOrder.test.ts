import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareForQueue, formatWaitingAge, hoursSince, isOldestFirstQueue, openDisputeStatuses, withdrawalQueueStatuses } from "@/utils/queueOrder.util";

describe("staff queues", () => {
  it("put the longest-waiting pending withdrawals and open disputes first, history newest first", () => {
    const times = ["2026-10-03T00:00:00Z", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"];
    const oldestFirst = isOldestFirstQueue(["pending_review"], withdrawalQueueStatuses);
    assert.deepEqual([...times].sort((first, second) => compareForQueue(first, second, oldestFirst)), ["2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z", "2026-10-03T00:00:00Z"]);
    assert.equal(isOldestFirstQueue(["awaiting_seller", "under_review"], openDisputeStatuses), true);
    assert.equal(isOldestFirstQueue(["resolved_refunded"], openDisputeStatuses), false);
    assert.equal(isOldestFirstQueue(null, withdrawalQueueStatuses), false);
  });

  it("show the waiting age", () => {
    assert.equal(formatWaitingAge(0), "under 1 h");
    assert.equal(formatWaitingAge(30), "30 h");
    assert.equal(formatWaitingAge(73), "3 d");
    assert.equal(hoursSince("2026-10-01T00:00:00Z", Date.parse("2026-10-01T05:30:00Z")), 5);
  });
});
