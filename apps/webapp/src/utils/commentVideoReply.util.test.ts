import assert from "node:assert/strict";
import test from "node:test";

import { commentVideoReplyHref } from "./commentVideoReply.util";

test("comment video reply opens its clip in the direct-start video viewer", () => {
  assert.equal(commentVideoReplyHref({ clipId: "clip-123" }), "/videos/suggested?start=clip-123");
});

test("comment video reply encodes the clip identifier as a query value", () => {
  assert.equal(commentVideoReplyHref({ clipId: "clip/with spaces" }), "/videos/suggested?start=clip%2Fwith%20spaces");
});
