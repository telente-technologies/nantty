import { describe, expect, it } from "vitest";

import { createGetPostConversationHandler } from "../../src/modules/comments/queries/getPostConversation/getPostConversation.handler.js";
import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";
import { chooseConversationChain, type ChainCandidate } from "../../src/modules/comments/services/commentChain.service.js";
import { decodeRankedCursor, rankConversationRoots } from "../../src/modules/comments/services/commentRanking.service.js";
import { createMemoryStore, type Row } from "./memoryDb.fake.js";
import { buildComment } from "./pinStore.fake.js";
import { authorId, buildPostRow } from "../posts/socialPostFakes.fake.js";

const postId = "0192f0a0-0000-7000-8000-0000000000a1";
const viewer = "0192f0a0-0000-7000-8000-00000000b001";
const userId = (index: number) => `0192f0a0-0000-7000-8000-0000000c${String(index).padStart(4, "0")}`;
const commentId = (index: number) => `0192f0a0-0000-7000-8000-00000e${String(index).padStart(6, "0")}`;

function root(index: number, overrides: Row = {}): Row {
  return buildComment({ id: commentId(index), postId, authorId: userId(index % 7), createdAt: new Date(Date.UTC(2026, 9, 10, 0, index)), likeCount: index % 5, ...overrides });
}

function reply(index: number, parent: Row, by: string, overrides: Row = {}): Row {
  const parentPath = String(parent["path"]);
  return buildComment({
    id: commentId(index), postId, authorId: by, parentCommentId: parent["id"], rootCommentId: parent["rootCommentId"] ?? parent["id"],
    depth: Number(parent["depth"]) + 1, path: parentPath === "" ? parent["id"] : `${parentPath}/${String(parent["id"])}`, createdAt: new Date(Date.UTC(2026, 9, 10, 6, index)), ...overrides,
  });
}

function seed(count: number) {
  const roots = Array.from({ length: count }, (_, index) => root(index + 1));
  const store = createMemoryStore({ posts: [{ ...buildPostRow({ id: postId, authorId }) } as Row], comments: roots });
  return { store, roots };
}

async function pageThrough(list: (cursor: string | undefined) => Promise<{ data: readonly { id: string }[]; nextCursor: string | null }>, between: (page: number) => void = () => undefined) {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await list(cursor);
    ids.push(...result.data.map((item) => item.id));
    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
    between(page);
  }
  return ids;
}

describe("top-level comment ranking", () => {
  it("puts the pinned comment first, then the author's comments, then threads the author joined, then engagement", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const make = (id: string, extra: Partial<{ authorId: string; isPinned: boolean; likeCount: number }> = {}) => ({ id, authorId: "someone", isPinned: false, likeCount: 0, replyCount: 0, createdAt: new Date("2026-10-10T10:00:00Z"), ...extra });
    const ranked = rankConversationRoots([make("a", { likeCount: 900 }), make("b", { authorId }), make("c"), make("d", { isPinned: true }), make("e", { likeCount: 5 })], { postAuthorId: authorId, authorRepliedRootIds: new Set(["c"]), now });
    expect(ranked.map((row) => row.id)).toEqual(["d", "b", "c", "a", "e"]);
  });

  it("pages a ranked list without duplicates or gaps while likes, pins, new comments and deletions change underneath", async () => {
    const { store, roots } = seed(47);
    (roots[40] as Row)["authorId"] = authorId;
    store.comments.push(reply(900, roots[30] as Row, authorId));
    const handler = createListPostCommentsHandler(store.context);
    const ids = await pageThrough((cursor) => handler({ viewerId: viewer, postId, cursor, limit: 10 }), (page) => {
      for (const row of roots) row["likeCount"] = Number(row["likeCount"]) + (page % 2 === 0 ? 50 : -50) * (Number(String(row["id"]).slice(-2)) % 3);
      (roots[5] as Row)["isPinned"] = page === 1;
      store.comments.push(root(500 + page, { createdAt: store.now }));
    });
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(47);
    expect(ids.slice(0, 2)).toEqual([commentId(41), commentId(31)]);
  });

  it("drops a comment deleted mid-paging without shifting the rest", async () => {
    const { store, roots } = seed(25);
    const handler = createListPostCommentsHandler(store.context);
    const first = await handler({ viewerId: viewer, postId, cursor: undefined, limit: 10 });
    const lastPageIds = new Set((await pageThrough((cursor) => handler({ viewerId: viewer, postId, cursor: cursor ?? first.nextCursor ?? undefined, limit: 10 }))).values());
    const target = roots.find((row) => lastPageIds.has(String(row["id"]))) as Row;
    target["deletedAt"] = store.now;
    const again = await pageThrough((cursor) => handler({ viewerId: viewer, postId, cursor: cursor ?? first.nextCursor ?? undefined, limit: 10 }));
    expect(again).toEqual([...lastPageIds].filter((id) => id !== target["id"]));
  });

  it("refuses a cursor from another post or viewer and garbage cursors", async () => {
    const { store } = seed(15);
    const handler = createListPostCommentsHandler(store.context);
    const first = await handler({ viewerId: viewer, postId, cursor: undefined, limit: 5 });
    await expect(handler({ viewerId: undefined, postId, cursor: first.nextCursor ?? undefined, limit: 5 })).rejects.toMatchObject({ code: "CURSOR_EXPIRED" });
    await expect(handler({ viewerId: viewer, postId, cursor: "not-a-cursor", limit: 5 })).rejects.toMatchObject({ status: 400 });
    expect(decodeRankedCursor(Buffer.from(JSON.stringify({ s: "x", o: -1 })).toString("base64url"))).toBeNull();
  });

  it("hides roots and chain replies from blocked and private accounts", async () => {
    const { store, roots } = seed(4);
    const blockedUser = userId(1);
    const privateUser = userId(2);
    store.blocks.push({ blockerId: viewer, blockedId: blockedUser });
    store.privateAccountIds.add(privateUser);
    const target = roots[3] as Row;
    const authorReply = reply(700, target, authorId);
    store.comments.push(authorReply, reply(701, authorReply, privateUser));
    const page = await createListPostCommentsHandler(store.context)({ viewerId: viewer, postId, cursor: undefined, limit: 10 });
    expect(page.data.map((item) => item.author.id)).not.toContain(blockedUser);
    expect(page.data.map((item) => item.author.id)).not.toContain(privateUser);
    const withChain = page.data.find((item) => item.id === target["id"]);
    expect(withChain?.previewReplies.map((item) => item.id)).toEqual([authorReply["id"]]);
    expect(withChain?.previewReplies[0]?.isPostAuthor).toBe(true);
  });

  it("returns the ranked conversation as nested chains on the thread endpoint", async () => {
    const { store, roots } = seed(3);
    const target = roots[0] as Row;
    const first = reply(800, target, authorId);
    const second = reply(801, first, String(target["authorId"]));
    const third = reply(802, second, authorId, { replyCount: 1 });
    store.comments.push(first, second, third, reply(803, third, String(target["authorId"])));
    const page = await createGetPostConversationHandler(store.context)({ viewerId: viewer, postId, sort: "relevant", cursor: undefined, limit: 10 });
    const top = page.data[0];
    expect(top?.id).toBe(target["id"]);
    expect(top?.inlineReplies[0]?.inlineReplies[0]?.inlineReplies[0]?.id).toBe(third["id"]);
    expect(top?.inlineReplies[0]?.inlineReplies[0]?.inlineReplies[0]?.continuesInThread).toBe(true);
    expect(top?.inlineReplies[0]?.isPostAuthor).toBe(true);
  });
});

describe("preview chains", () => {
  const node = (id: string, by: string, parent: string | null, likeCount = 0): ChainCandidate => ({ id, authorId: by, parentCommentId: parent, likeCount, replyCount: 0 });

  it("follows the back-and-forth between the commenter and the post author", () => {
    const rootNode = node("r", "user", null);
    const chain = chooseConversationChain(rootNode, [node("a1", "author", "r"), node("x", "other", "r", 99), node("u1", "user", "a1"), node("a2", "author", "u1"), node("u2", "user", "a2")], "author");
    expect(chain.map((item) => item.id)).toEqual(["a1", "u1", "a2"]);
  });

  it("falls back to the top reply plus the author's reply under it", () => {
    const chain = chooseConversationChain(node("r", "user", null), [node("x", "other", "r", 1), node("y", "other", "r", 9), node("ay", "author", "y")], "author");
    expect(chain.map((item) => item.id)).toEqual(["y", "ay"]);
  });

  it("stops the chain where a reply is missing, such as after the author deletes theirs", () => {
    const chain = chooseConversationChain(node("r", "user", null), [node("u1", "user", "a1-deleted"), node("x", "other", "r")], "author");
    expect(chain.map((item) => item.id)).toEqual(["x"]);
  });

  it("returns nothing for a comment with no replies", () => {
    expect(chooseConversationChain(node("r", "user", null), [], "author")).toEqual([]);
  });
});
