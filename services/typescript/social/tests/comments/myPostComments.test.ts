import { describe, expect, it } from "vitest";

import { createHideCommentHandler } from "../../src/modules/comments/commands/hideComment/hideComment.handler.js";
import { createListMyPostCommentsHandler } from "../../src/modules/comments/queries/listMyPostComments/listMyPostComments.handler.js";
import type { MyPostCommentsFilter } from "../../src/modules/comments/models/myPostComments.model.js";
import { authorId, buildPostRow } from "../posts/socialPostFakes.fake.js";
import { createMemoryStore, type Row } from "./memoryDb.fake.js";
import { buildComment } from "./pinStore.fake.js";

const postA = "0192f0a0-0000-7000-8000-0000000000a1";
const postB = "0192f0a0-0000-7000-8000-0000000000a2";
const someoneElsesPost = "0192f0a0-0000-7000-8000-0000000000a3";
const otherCreator = "0192f0a0-0000-7000-8000-00000000f001";
const fan = (index: number) => `0192f0a0-0000-7000-8000-0000000c${String(index).padStart(4, "0")}`;
const commentId = (index: number) => `0192f0a0-0000-7000-8000-00000e${String(index).padStart(6, "0")}`;

function seed() {
  const comments: Row[] = [];
  for (let index = 1; index <= 25; index += 1) comments.push(buildComment({ id: commentId(index), postId: index % 2 === 0 ? postA : postB, authorId: fan(index), text: index === 7 ? "Ship to Abuja?" : `comment ${index}` }));
  comments.push(buildComment({ id: commentId(100), postId: postA, authorId, parentCommentId: commentId(2), rootCommentId: commentId(2), depth: 1, path: commentId(2) }));
  comments.push(buildComment({ id: commentId(101), postId: someoneElsesPost, authorId: fan(1) }));
  comments.push(buildComment({ id: commentId(102), postId: postA, authorId: fan(3), deletedAt: new Date("2026-10-04T11:30:00Z") }));
  (comments.find((row) => row["id"] === commentId(4)) as Row)["isPinned"] = true;
  return createMemoryStore({
    posts: [
      { ...buildPostRow({ id: postA, authorId, commentCount: 14 }) } as Row,
      { ...buildPostRow({ id: postB, authorId, commentCount: 13 }) } as Row,
      { ...buildPostRow({ id: someoneElsesPost, authorId: otherCreator, commentCount: 1 }) } as Row,
    ],
    comments,
  });
}

async function collect(store: ReturnType<typeof seed>, filter: MyPostCommentsFilter, extra: { postId?: string; search?: string } = {}) {
  const list = createListMyPostCommentsHandler(store.context);
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await list({ ownerId: authorId, filter, postId: extra.postId, search: extra.search, cursor, limit: 10 });
    ids.push(...page.data.map((item) => item.id));
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor !== undefined && pages < 10);
  return { ids, pages };
}

describe("comments on my posts", () => {
  it("pages every top-level comment on my posts, newest first, without gaps or strangers' posts", async () => {
    const store = seed();
    const { ids, pages } = await collect(store, "all");
    expect(pages).toBe(3);
    expect(ids).toEqual(Array.from({ length: 25 }, (_, index) => commentId(25 - index)));
    const first = await createListMyPostCommentsHandler(store.context)({ ownerId: authorId, filter: "all", postId: undefined, search: undefined, cursor: undefined, limit: 30 });
    const replied = first.data.find((item) => item.id === commentId(2));
    expect(replied).toMatchObject({ needsReply: false, hidden: false, post: { id: postA } });
    expect(replied?.previewReplies.map((reply) => reply.id)).toEqual([commentId(100)]);
  });

  it("filters needs reply, pinned, by post and by text", async () => {
    const store = seed();
    expect((await collect(store, "needs_reply")).ids).toHaveLength(24);
    expect((await collect(store, "needs_reply")).ids).not.toContain(commentId(2));
    expect((await collect(store, "pinned")).ids).toEqual([commentId(4)]);
    expect((await collect(store, "all", { postId: postA })).ids).toHaveLength(12);
    expect((await collect(store, "all", { search: "abuja" })).ids).toEqual([commentId(7)]);
  });

  it("moves hidden comments, replies included, into the hidden filter only", async () => {
    const store = seed();
    const hide = createHideCommentHandler(store.context);
    await hide({ actorId: authorId, postId: postB, commentId: commentId(5) });
    store.comments.push(buildComment({ id: commentId(200), postId: postA, authorId: fan(9), parentCommentId: commentId(6), rootCommentId: commentId(6), depth: 1, path: commentId(6) }));
    await hide({ actorId: authorId, postId: postA, commentId: commentId(200) });
    const hidden = await createListMyPostCommentsHandler(store.context)({ ownerId: authorId, filter: "hidden", postId: undefined, search: undefined, cursor: undefined, limit: 10 });
    expect(hidden.data.map((item) => item.id)).toEqual([commentId(200), commentId(5)]);
    expect(hidden.data.every((item) => item.hidden && item.hiddenAt !== null && !item.needsReply)).toBe(true);
    expect((await collect(store, "all")).ids).not.toContain(commentId(5));
    expect((await collect(store, "needs_reply")).ids).not.toContain(commentId(5));
  });

  it("only lists comments on the caller's own posts", async () => {
    const store = seed();
    const page = await createListMyPostCommentsHandler(store.context)({ ownerId: otherCreator, filter: "all", postId: postA, search: undefined, cursor: undefined, limit: 10 });
    expect(page.data).toEqual([]);
  });
});
