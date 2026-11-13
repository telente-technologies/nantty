import assert from "node:assert/strict";
import test from "node:test";

import type { Comment } from "@/types";
import { commentAuthorProfileHref } from "./commentAuthorProfileHref.util";

const baseComment = {
  author: { id: "user-1", name: "Ada", username: "ada", avatarUrl: null, verified: false },
  postedAs: null,
} as Pick<Comment, "author" | "postedAs">;

test("comment author links to the personal profile when commenting as themself", () => {
  assert.equal(commentAuthorProfileHref(baseComment), "/ada");
});

test("managed-profile comments link to the selected profile handle", () => {
  assert.equal(commentAuthorProfileHref({
    ...baseComment,
    postedAs: { id: "store-1", kind: "store", name: "Ada Store", handle: "ada store", avatarUrl: null },
  }), "/ada%20store");
});
