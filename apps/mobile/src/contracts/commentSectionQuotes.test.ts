import { resolveMockApiRequest } from "@/mocks";
import type { CommentWithReplies, Page, Post } from "@/types";
import { isQuoteThreadItem, type QuoteThreadItem, type ThreadReply } from "@/types/postThread.type";

import { c, validateAgainstContract } from "./contractSchema.util";

const quoteItemContract = c.object({
  type: c.string(["quote"]),
  id: c.string(),
  postId: c.string(),
  quotePost: c.object({ id: c.string(), author: c.object({ id: c.string(), username: c.string() }), text: c.string(), mediaCount: c.number(), createdAt: c.string() }),
  likes: c.number(),
  commentCount: c.number(),
  isPostAuthor: c.boolean(),
  createdAt: c.string(),
});

type SectionItem = CommentWithReplies | QuoteThreadItem;
const createPost = (text: string, quotedPostId?: string | null) =>
  resolveMockApiRequest<Post>("POST", "/api/v1/posts", { text, mediaIds: [], audience: "everyone", kind: "post", ...(quotedPostId === undefined ? {} : { quotedPostId }) });
const listComments = (postId: string, query = "") => resolveMockApiRequest<Page<SectionItem>>("GET", `/api/v1/posts/${postId}/comments${query}`, undefined);
const listThread = (postId: string, query = "") => resolveMockApiRequest<Page<ThreadReply | QuoteThreadItem>>("GET", `/api/v1/posts/${postId}/thread${query}`, undefined);
const quoteIds = (items: readonly object[]) => items.filter(isQuoteThreadItem).map((item) => item.id);
const getPost = (postId: string) => resolveMockApiRequest<Post>("GET", `/api/v1/posts/${postId}`, undefined);

describe("quotes in the comment section (mocks)", () => {
  jest.setTimeout(30_000);

  it("shows a quote made with the button or a trailing link in the original's comments and thread", async () => {
    const original = await createPost("original thought");
    const viaButton = await createPost("my take", original.id);
    const viaLink = await createPost(`hot take https://app.zudomart.com/post/${original.id}`);
    expect(viaLink).toMatchObject({ text: "hot take", isQuote: true, resharedFrom: { id: original.id } });
    const listed = await listComments(original.id);
    expect(quoteIds(listed.data).sort()).toEqual([viaButton.id, viaLink.id].sort());
    for (const item of listed.data.filter(isQuoteThreadItem)) expect(validateAgainstContract(quoteItemContract, item)).toEqual([]);
    expect(quoteIds((await listThread(original.id, "?sort=relevant")).data)).toHaveLength(2);
    expect(quoteIds((await listThread(original.id, "?sort=latest")).data)).toHaveLength(0);
    const onlyQuotes = await listComments(original.id, "?filter=quotes");
    expect(onlyQuotes.data.every((item) => isQuoteThreadItem(item))).toBe(true);
    expect(onlyQuotes.data[0]?.id).toBe(viaLink.id);
  });

  it("drops a deleted quote from the comment section and fixes the counts", async () => {
    const original = await createPost("delete me later");
    const quote = await createPost("quoting", original.id);
    expect((await getPost(original.id)).quotes).toBe(1);
    await resolveMockApiRequest("DELETE", `/api/v1/posts/${quote.id}`, undefined);
    expect(quoteIds((await listComments(original.id)).data)).toEqual([]);
    expect((await getPost(original.id)).quotes).toBe(0);
  });

  it("quotes a quote one level deep and lets you quote your own post", async () => {
    const original = await createPost("mine");
    const quote = await createPost("quoting myself", original.id);
    const quoteOfQuote = await createPost("and again", quote.id);
    expect(quoteOfQuote.resharedFrom?.id).toBe(quote.id);
    expect(quoteOfQuote.resharedFrom?.resharedFrom ?? null).toBeNull();
    expect(quoteIds((await listComments(quote.id)).data)).toEqual([quoteOfQuote.id]);
  });

  it("refuses an explicit quote of a post deleted while composing", async () => {
    const original = await createPost("about to vanish");
    await resolveMockApiRequest("DELETE", `/api/v1/posts/${original.id}`, undefined);
    await expect(createPost("too late", original.id)).rejects.toMatchObject({ status: 422, code: "QUOTED_POST_UNAVAILABLE" });
  });

  it("makes a plain repost one tap, idempotent and undoable", async () => {
    const original = await createPost("repost me");
    const first = await resolveMockApiRequest<Post>("POST", `/api/v1/posts/${original.id}/repost`, {});
    const second = await resolveMockApiRequest<Post>("POST", `/api/v1/posts/${original.id}/repost`, {});
    expect(second.id).toBe(first.id);
    expect(await getPost(original.id)).toMatchObject({ reposted: true, reposts: 1 });
    await resolveMockApiRequest("DELETE", `/api/v1/posts/${original.id}/repost`, undefined);
    await resolveMockApiRequest("DELETE", `/api/v1/posts/${original.id}/repost`, undefined);
    expect(await getPost(original.id)).toMatchObject({ reposted: false, reposts: 0 });
  });
});
