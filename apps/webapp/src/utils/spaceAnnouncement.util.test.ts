import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { spaceAnnouncementDisplayText, spaceIdFromAnnouncement } from "./spaceAnnouncement.util";

describe("Space announcement copy", () => {
  const post = "Join my Space: A talk about art\nhttps://web.nantty.com/spaces/space-123";

  it("keeps the room identifier available for routing", () => {
    assert.equal(spaceIdFromAnnouncement(post), "space-123");
  });

  it("hides the implementation URL from visible post copy", () => {
    assert.equal(spaceAnnouncementDisplayText(post), "Join my Space: A talk about art");
  });

  it("preserves unrelated post URLs", () => {
    assert.equal(spaceAnnouncementDisplayText("Read this https://example.com"), "Read this https://example.com");
  });
});
