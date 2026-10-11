import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGuestBrowsablePage } from "@/config/guestBrowsing.config";

import { classifyContentLoadFailure, contentLoadFailureCopy } from "./contentAvailability.util";

describe("deep links to missing or private content", () => {
  it("tells deleted, private and failed loads apart", () => {
    assert.equal(classifyContentLoadFailure({ status: 404 }), "gone");
    assert.equal(classifyContentLoadFailure({ status: 410 }), "gone");
    assert.equal(classifyContentLoadFailure({ status: 403 }), "denied");
    assert.equal(classifyContentLoadFailure({ status: 0 }), "failed");
    assert.equal(classifyContentLoadFailure(new Error("x")), "failed");
    assert.equal(contentLoadFailureCopy.reply.gone.title, "This reply is no longer available.");
  });
});

describe("signed-out access", () => {
  it("lets guests read posts and threads but never the composer", () => {
    assert.equal(isGuestBrowsablePage("/post/post_1"), true);
    assert.equal(isGuestBrowsablePage("/post/post_1/comment/c_1"), true);
    assert.equal(isGuestBrowsablePage("/post/new"), false);
    assert.equal(isGuestBrowsablePage("/saved"), false);
  });
});
