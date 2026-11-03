import assert from "node:assert/strict";
import { test } from "node:test";

import { threadReplyAuthorProfileHref } from "./threadReplyAuthorProfile.util";

test("managed-profile replies do not link their displayed avatar to the personal author", () => {
  assert.equal(
    threadReplyAuthorProfileHref("oluw", {
      id: "profile-1",
      kind: "business",
      name: "Nantty Store",
      handle: "nantty-store",
      avatarUrl: null,
    }),
    null,
  );
});

test("personal replies retain the author's profile link", () => {
  assert.equal(threadReplyAuthorProfileHref("amina", null), "/amina");
});
