import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeLiveAccessLock } from "./liveAccessLock.util";

describe("locked lives", () => {
  it("asks a stranger to follow or subscribe, and never locks an allowed or older response", () => {
    assert.deepEqual(describeLiveAccessLock({ allowed: false, reason: "followersOnly" }), { title: "Follow to watch", body: "This live is only for the host's followers.", action: "follow" });
    assert.deepEqual(describeLiveAccessLock({ allowed: false, reason: "subscribersOnly" }), { title: "Subscribe to watch", body: "This live is only for the host's subscribers.", action: "subscribe" });
    assert.equal(describeLiveAccessLock({ allowed: false, reason: "banned" })?.action, null);
    assert.equal(describeLiveAccessLock({ allowed: true, reason: "allowed" }), null);
    assert.equal(describeLiveAccessLock(undefined), null);
  });
});
