import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Comment } from "@/types";
import { buildClipVideoReplyTarget, canReplyToCommentWithVideo, clipVideoReplyHref, readClipVideoReplyTarget } from "./clipVideoReply.util";

const comment = { id: "comment-1", postId: "clip-1", author: { id: "user-1" } } as Comment;

describe("clip video replies", () => {
  it("only builds the exact server target for a persisted comment on the active clip", () => {
    assert.deepEqual(buildClipVideoReplyTarget(comment, "clip-1"), { commentId: "comment-1", clipId: "clip-1", commenterUserId: "user-1" });
    assert.equal(canReplyToCommentWithVideo({ ...comment, postId: "clip-2" }, "clip-1"), false);
    assert.equal(canReplyToCommentWithVideo({ ...comment, id: "pending_1" }, "clip-1"), false);
    assert.equal(canReplyToCommentWithVideo({ ...comment, videoReplyBlocked: true }, "clip-1"), false);
  });

  it("round trips the target through the existing clip composer route", () => {
    const target = buildClipVideoReplyTarget(comment, "clip-1")!;
    assert.equal(clipVideoReplyHref(target), "/create/clip?replyCommentId=comment-1&replyClipId=clip-1&replyCommenterUserId=user-1");
    assert.deepEqual(readClipVideoReplyTarget(new URLSearchParams(clipVideoReplyHref(target).split("?")[1])), target);
    assert.equal(readClipVideoReplyTarget(new URLSearchParams("replyCommentId=comment-1")), undefined);
  });
});
