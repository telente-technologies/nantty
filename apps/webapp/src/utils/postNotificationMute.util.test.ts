import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canOfferPostNotificationMute, postNotificationMuteLabel } from "./postNotificationMute.util";

describe("post notification mute menu", () => {
  it("is hidden from signed-out viewers and on sponsored posts", () => {
    assert.equal(canOfferPostNotificationMute(false, {}), false);
    assert.equal(canOfferPostNotificationMute(true, { sponsored: { label: "Sponsored" } }), false);
    assert.equal(canOfferPostNotificationMute(true, { sponsored: null }), true);
  });

  it("labels both states", () => {
    assert.equal(postNotificationMuteLabel(false), "Turn off notifications for this post");
    assert.equal(postNotificationMuteLabel(true), "Turn on notifications for this post");
  });
});
