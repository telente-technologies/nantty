import { describe, expect, it } from "vitest";

import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { authorId, buildPostRow, viewerId } from "../posts/socialPostFakes.fake.js";
import { createMemoryStore, type Row } from "./memoryDb.fake.js";
import { buildComment, postId } from "./pinStore.fake.js";

const quotedId = "0192f0a0-0000-7000-8000-0000000000a9";
const rootId = "0192f0a0-0000-7000-8000-0000000000c1";
const replyId = "0192f0a0-0000-7000-8000-0000000000c2";
const childId = "0192f0a0-0000-7000-8000-0000000000c3";

function setup() {
  return createMemoryStore({
    posts: [
      { ...buildPostRow({ id: postId, authorId, commentCount: 3 }) } as Row,
      { ...buildPostRow({ id: quotedId, authorId, quoteCount: 5 }) } as Row,
    ],
    comments: [
      buildComment({ id: rootId, replyCount: 1 }),
      buildComment({ id: replyId, parentCommentId: rootId, rootCommentId: rootId, depth: 1, path: rootId, replyCount: 1, quotedPostId: quotedId }),
      buildComment({ id: childId, parentCommentId: replyId, rootCommentId: rootId, depth: 2, path: `${rootId}/${replyId}`, quotedPostId: quotedId }),
    ],
  });
}

const find = (rows: Row[], id: string) => rows.find((row) => row["id"] === id) as Row;

describe("SOC-04 delete comment counters", () => {
  it("decrements counters exactly once when the same comment is deleted concurrently", async () => {
    const store = setup();
    const remove = createDeleteCommentHandler(store.context);
    await Promise.all([remove({ actorId: viewerId, commentId: replyId }), remove({ actorId: viewerId, commentId: replyId })]);
    expect(find(store.comments, rootId)["replyCount"]).toBe(0);
    expect(find(store.posts, postId)["commentCount"]).toBe(1);
    expect(find(store.posts, quotedId)["quoteCount"]).toBe(3);
    expect(store.events.filter((event) => event["eventType"] === "comment.deleted")).toHaveLength(1);
  });
});
