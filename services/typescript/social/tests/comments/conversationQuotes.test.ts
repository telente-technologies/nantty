import { describe, expect, it } from "vitest";

import { createGetPostConversationHandler } from "../../src/modules/comments/queries/getPostConversation/getPostConversation.handler.js";
import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";
import { createMemoryStore, type Row } from "./memoryDb.fake.js";
import { buildComment } from "./pinStore.fake.js";
import { authorId, buildPostRow } from "../posts/socialPostFakes.fake.js";

const postId = "0192f0a0-0000-7000-8000-0000000000a1";
const viewer = "0192f0a0-0000-7000-8000-00000000b001";
const userId = (index: number) => `0192f0a0-0000-7000-8000-0000000c${String(index).padStart(4, "0")}`;
const commentId = (index: number) => `0192f0a0-0000-7000-8000-00000e${String(index).padStart(6, "0")}`;
const quoteId = (index: number) => `0192f0a0-0000-7000-8000-00000f${String(index).padStart(6, "0")}`;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 10, 0, minute));

function quote(index: number, overrides: Row = {}): Row {
  return { ...buildPostRow({ id: quoteId(index), authorId: userId(index % 7), text: `Quote ${index}`, resharedFromId: postId, isQuote: true, createdAt: at(index), likeCount: index % 4 }), ...overrides } as Row;
}

function seed(commentCount: number, quotes: Row[]) {
  const comments = Array.from({ length: commentCount }, (_, index) => buildComment({ id: commentId(index + 1), postId, authorId: userId((index + 1) % 7), createdAt: at(index + 1), likeCount: (index + 1) % 5 }));
  const store = createMemoryStore({ posts: [buildPostRow({ id: postId, authorId }) as unknown as Row, ...quotes], comments });
  return { store, comments };
}

type Item = { readonly id: string; readonly type?: string };
async function pageThrough(list: (cursor: string | undefined) => Promise<{ data: readonly Item[]; nextCursor: string | null }>, between: (page: number) => void = () => undefined): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 30; page += 1) {
    const result = await list(cursor);
    items.push(...result.data);
    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
    between(page);
  }
  return items;
}

describe("quotes in the comment section", () => {
  it("lists quotes as typed items ranked after pinned and author comments, by engagement", async () => {
    const { store, comments } = seed(3, [quote(1, { likeCount: 500 }), quote(2)]);
    (comments[0] as Row)["isPinned"] = true;
    (comments[1] as Row)["authorId"] = authorId;
    const page = await createListPostCommentsHandler(store.context)({ viewerId: viewer, postId, cursor: undefined, limit: 20 });
    expect(page.data.map((item) => [item.type, item.id])).toEqual([["comment", commentId(1)], ["comment", commentId(2)], ["quote", quoteId(1)], ["comment", commentId(3)], ["quote", quoteId(2)]]);
    const item = page.data[2];
    expect(item?.type === "quote" ? { text: item.quotePost.text, author: item.quotePost.author.id, likes: item.likes, postId: item.postId } : null).toEqual({ text: "Quote 1", author: userId(1), likes: 500, postId });
  });

  it("ignores plain reposts, deleted quotes and quotes of other posts", async () => {
    const other = "0192f0a0-0000-7000-8000-0000000000a2";
    const { store } = seed(0, [quote(1, { isQuote: false }), quote(2, { deletedAt: at(50) }), quote(3, { resharedFromId: other }), quote(4, { moderationVisibility: "hidden" }), quote(5)]);
    const page = await createListPostCommentsHandler(store.context)({ viewerId: viewer, postId, cursor: undefined, limit: 20 });
    expect(page.data.map((item) => item.id)).toEqual([quoteId(5)]);
  });

  it("hides quotes from blocked and private accounts, follower-only quotes and subscriber-only quotes", async () => {
    const { store } = seed(0, [quote(1), quote(2), quote(3, { audience: "followers" }), quote(4, { visibility: "subscribers" }), quote(5)]);
    store.blocks.push({ blockerId: userId(1), blockedId: viewer });
    store.privateAccountIds.add(userId(2));
    const listed = await createListPostCommentsHandler(store.context)({ viewerId: viewer, postId, cursor: undefined, limit: 20 });
    expect(listed.data.map((item) => item.id)).toEqual([quoteId(5)]);
    const onlyQuotes = await createListPostCommentsHandler(store.context)({ viewerId: viewer, postId, filter: "quotes", cursor: undefined, limit: 20 });
    expect(onlyQuotes.data.map((item) => item.id)).toEqual([quoteId(5)]);
  });

  it("pages a mixed list without duplicates or gaps and drops a quote deleted mid-paging", async () => {
    const quotes = Array.from({ length: 13 }, (_, index) => quote(index + 1));
    const { store } = seed(30, quotes);
    const handler = createListPostCommentsHandler(store.context);
    const all = await pageThrough((cursor) => handler({ viewerId: viewer, postId, cursor, limit: 7 }));
    expect(new Set(all.map((item) => item.id)).size).toBe(43);
    expect(all.filter((item) => item.type === "quote")).toHaveLength(13);
    const seen: Item[] = [];
    const doomed = all.at(-1) as Item;
    seen.push(...(await pageThrough((cursor) => handler({ viewerId: viewer, postId, cursor, limit: 7 }), (page) => {
      if (page === 0) (store.posts.find((row) => row["id"] === doomed.id) ?? store.comments.find((row) => row["id"] === doomed.id) as Row)["deletedAt"] = store.now;
    })));
    expect(seen.map((item) => item.id)).toEqual(all.slice(0, -1).map((item) => item.id));
  });

  it("keeps a fresh snapshot's tail detection correct when quotes share the snapshot", async () => {
    const { store } = seed(5, [quote(1), quote(2)]);
    const handler = createListPostCommentsHandler(store.context);
    await handler({ viewerId: viewer, postId, cursor: undefined, limit: 2 });
    const reused = await handler({ viewerId: viewer, postId, cursor: undefined, limit: 20 });
    expect(store.snapshots).toHaveLength(1);
    expect(reused.data).toHaveLength(7);
    expect(reused.nextCursor).toBeNull();
  });

  it("mixes quotes into the ranked thread endpoint and pages the Quotes filter newest first", async () => {
    const quotes = Array.from({ length: 5 }, (_, index) => quote(index + 1));
    const { store } = seed(2, quotes);
    const handler = createGetPostConversationHandler(store.context);
    const ranked = await handler({ viewerId: viewer, postId, sort: "relevant", cursor: undefined, limit: 20 });
    expect(ranked.data.filter((item) => item.type === "quote")).toHaveLength(5);
    expect(ranked.data.filter((item) => item.type === "comment")).toHaveLength(2);
    const latest = await handler({ viewerId: viewer, postId, sort: "latest", cursor: undefined, limit: 20 });
    expect(latest.data.every((item) => item.type === "comment")).toBe(true);
    const quotesOnly = await pageThrough((cursor) => handler({ viewerId: viewer, postId, sort: "relevant", filter: "quotes", cursor, limit: 2 }));
    expect(quotesOnly.map((item) => item.id)).toEqual([5, 4, 3, 2, 1].map(quoteId));
    await expect(handler({ viewerId: viewer, postId, sort: "relevant", filter: "quotes", cursor: "garbage", limit: 2 })).rejects.toMatchObject({ status: 400 });
  });
});
