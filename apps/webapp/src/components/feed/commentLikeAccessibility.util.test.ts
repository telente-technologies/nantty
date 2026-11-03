import assert from "node:assert/strict";
import test from "node:test";

import { describeCommentLikeAccessibility } from "./commentLikeAccessibility.util";

test("comment like control announces an unliked state and its count", () => {
  assert.deepEqual(describeCommentLikeAccessibility(false, "12", "Amina"), {
    label: "Like comment by Amina, 12 likes",
    pressed: false,
  });
});

test("comment like control announces the active toggle state", () => {
  assert.deepEqual(describeCommentLikeAccessibility(true, "1", "Amina"), {
    label: "Unlike comment by Amina, 1 like",
    pressed: true,
  });
});
