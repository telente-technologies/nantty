import { describeLiveAccessLock } from "../liveAccessLock.util";

describe("locked lives", () => {
  it("matches the web copy", () => {
    expect(describeLiveAccessLock({ allowed: false, reason: "followersOnly" })).toEqual({ title: "Follow to watch", body: "This live is only for the host's followers.", action: "follow" });
    expect(describeLiveAccessLock({ allowed: false, reason: "subscribersOnly" })).toEqual({ title: "Subscribe to watch", body: "This live is only for the host's subscribers.", action: "subscribe" });
    expect(describeLiveAccessLock({ allowed: false, reason: "banned" })?.action).toBeNull();
    expect(describeLiveAccessLock({ allowed: true, reason: "allowed" })).toBeNull();
    expect(describeLiveAccessLock(undefined)).toBeNull();
  });
});
