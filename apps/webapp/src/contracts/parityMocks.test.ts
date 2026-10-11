import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commentsForPost } from "@/mocks/comments.mock";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { mockPostsState } from "@/mocks/postCatalog.mock";
import type { Conversation, Post, SavedItem, TagCandidate } from "@/types";

import { c, validateAgainstContract } from "./contractSchema.util";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const send = (method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body));
const failureCode = (promise: Promise<unknown>) => promise.then(() => "OK", (error: { code?: string }) => error.code ?? "UNKNOWN");

const conversation = c.object({ id: c.string(), peer: c.object({ id: c.string(), username: c.string() }), lastMessage: c.string(), lastMessageAt: c.string(), unread: c.number(), isFriend: c.boolean(), inboxFolder: c.string(["chats", "requests", "spam"]) }, ["inboxFolder"]);

async function uploadMockImage(): Promise<string> {
  const session = (await send("POST", "/api/v1/media/uploads", { fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1000, purpose: "post" })) as { uploadId: string; totalChunks: number };
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex++) await send("PUT", `/api/v1/media/uploads/${session.uploadId}/chunks/${chunkIndex}`);
  return ((await send("POST", `/api/v1/media/uploads/${session.uploadId}/complete`)) as { mediaId: string }).mediaId;
}

describe("message requests and inbox folders", () => {
  it("lists each folder separately, like the social service", async () => {
    const chats = (await send("GET", "/api/v1/conversations", undefined, { filter: "all" })) as Conversation[];
    const requests = (await send("GET", "/api/v1/conversations", undefined, { folder: "requests" })) as Conversation[];
    const spam = (await send("GET", "/api/v1/conversations", undefined, { folder: "spam" })) as Conversation[];
    for (const row of [...chats, ...requests, ...spam]) assert.deepEqual(validateAgainstContract(conversation, row), []);
    assert.ok(requests.length > 0 && requests.every((row) => row.inboxFolder === "requests"));
    assert.ok(spam.length > 0 && spam.every((row) => row.inboxFolder === "spam"));
    assert.ok(chats.every((row) => (row.inboxFolder ?? "chats") === "chats"));
  });

  it("accepting a request or marking spam as safe moves it to chats, and deleting removes it", async () => {
    const [request] = (await send("GET", "/api/v1/conversations", undefined, { folder: "requests" })) as Conversation[];
    const accepted = (await send("POST", `/api/v1/conversations/${request!.id}/accept`)) as Conversation;
    assert.equal(accepted.inboxFolder, "chats");
    const [spam] = (await send("GET", "/api/v1/conversations", undefined, { folder: "spam" })) as Conversation[];
    await send("DELETE", `/api/v1/conversations/${spam!.id}`);
    const remaining = (await send("GET", "/api/v1/conversations", undefined, { folder: "spam" })) as Conversation[];
    assert.ok(!remaining.some((row) => row.id === spam!.id));
    assert.equal(await failureCode(send("POST", `/api/v1/conversations/${spam!.id}/not-spam`)), "CONVERSATION_NOT_FOUND");
  });
});

describe("saved replies", () => {
  it("saves a comment and returns the backend preview shape with the comment", async () => {
    const comment = commentsForPost("post_1")[0]!;
    const saved = (await send("POST", "/api/v1/saves", { type: "comment", targetId: comment.id })) as SavedItem;
    assert.equal(saved.type, "comment");
    assert.equal(saved.comment?.postId, "post_1");
    assert.equal(saved.postId, "post_1");
    assert.equal(typeof saved.preview.author, "string");
    const page = (await send("GET", "/api/v1/saves", undefined, { type: "comment" })) as { data: SavedItem[] };
    assert.ok(page.data.some((item) => item.targetId === comment.id));
  });
});

describe("post composer", () => {
  it("publishes text, media, mentions, settings, tags, products and a quote", async () => {
    const mediaId = await uploadMockImage();
    const productId = ((await send("GET", "/api/v1/products/featured")) as { id: string }[])[0]!.id;
    const tagged = ((await send("GET", "/api/v1/tags/candidates", undefined, { q: "a" })) as { candidates: TagCandidate[] }).candidates.find((candidate) => candidate.canTag)!;
    const post = (await send("POST", "/api/v1/posts", {
      text: "New drop @ada #lagos",
      mediaIds: [mediaId],
      audience: "followers",
      kind: "post",
      replyPolicy: "mentioned",
      visibility: "public",
      sensitiveLabels: ["graphic_violence"],
      isAiGenerated: true,
      taggedUserIds: [tagged.user.id],
      productIds: [productId],
      quotedPostId: "post_3",
    })) as Post;
    assert.equal(post.media.length, 1);
    assert.equal(post.replyPolicy, "mentioned");
    assert.equal(post.products[0]?.id, productId);
    assert.equal(post.taggedUsers?.[0]?.id, tagged.user.id);
    assert.equal(post.resharedFrom?.id, "post_3");
    assert.ok(mockPostsState.has(post.id));
    const fetched = (await send("GET", `/api/v1/posts/${post.id}`)) as Post;
    assert.equal(fetched.id, post.id);
  });

  it("rejects the same payloads the social service rejects", async () => {
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { text: "   ", mediaIds: [], audience: "everyone" })), "POST_EMPTY");
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { text: "x".repeat(2201), mediaIds: [], audience: "everyone" })), "TEXT_TOO_LONG");
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { text: "hi", mediaIds: ["missing"], audience: "everyone" })), "MEDIA_NOT_FOUND");
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { text: "hi", mediaIds: [], audience: "everyone", productIds: ["nope"] })), "PRODUCT_NOT_TAGGABLE");
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { text: "hi", mediaIds: [], audience: "everyone", quotedPostId: "deleted_post" })), "POST_NOT_FOUND");
  });

  it("returns the same post when an identical publish is replayed straight away", async () => {
    const body = { text: `double tap ${Date.now()}`, mediaIds: [], audience: "everyone" };
    const first = (await send("POST", "/api/v1/posts", body)) as Post;
    const second = (await send("POST", "/api/v1/posts", body)) as Post;
    assert.equal(first.id, second.id);
  });
});

describe("comment thread deep links", () => {
  it("returns the focus, its ancestors and replies like the social service", async () => {
    const reply = commentsForPost("post_1").find((comment) => comment.parentCommentId !== null)!;
    const page = (await send("GET", `/api/v1/comments/${reply.id}/thread`)) as { focus: { id: string }; ancestors: { id: string }[]; data: unknown[]; maximumVisibleDepth: number };
    assert.equal(page.focus.id, reply.id);
    assert.equal(page.ancestors.at(-1)?.id, reply.parentCommentId);
    assert.equal(typeof page.maximumVisibleDepth, "number");
  });

  it("answers 404 for a deleted reply instead of an empty thread", async () => {
    assert.equal(await failureCode(send("GET", "/api/v1/comments/deleted_reply/thread")), "COMMENT_NOT_FOUND");
  });
});

describe("profile parity", () => {
  it("lists, approves and declines follow requests", async () => {
    const page = (await send("GET", "/api/v1/users/me/follow-requests")) as { data: { id: string; requester: { username: string } }[] };
    assert.ok(page.data.length >= 2);
    await send("POST", `/api/v1/follow-requests/${page.data[0]!.id}/accept`);
    await send("POST", `/api/v1/follow-requests/${page.data[1]!.id}/reject`);
    assert.equal(await failureCode(send("POST", `/api/v1/follow-requests/${page.data[0]!.id}/accept`)), "FOLLOW_REQUEST_NOT_FOUND");
  });

  it("saves name, bio and uploaded avatar like the identity service", async () => {
    const mediaId = await uploadMockImage();
    const updated = (await send("PATCH", "/api/v1/users/me", { name: "  Temi O.  ", bio: "Lagos maker", avatarMediaId: mediaId })) as { name: string; bio: string; avatarUrl: string | null };
    assert.equal(updated.name, "Temi O.");
    assert.equal(updated.bio, "Lagos maker");
    assert.ok(updated.avatarUrl);
    assert.equal(await failureCode(send("PATCH", "/api/v1/users/me", { bio: "x".repeat(1201) })), "VALIDATION_FAILED");
    assert.equal(await failureCode(send("PATCH", "/api/v1/users/me", { avatarMediaId: "missing" })), "MEDIA_NOT_FOUND");
  });
});

describe("review after purchase", () => {
  it("accepts one review for a delivered product and rejects the rest like the catalog service", async () => {
    const delivered = "pr_g6";
    const notReceived = "pr_f4";
    const review = (await send("POST", `/api/v1/products/${delivered}/reviews`, { rating: 5, text: "Great sound", title: null })) as { isVerifiedPurchase: boolean; author: { username: string } };
    assert.equal(review.isVerifiedPurchase, true);
    assert.equal(await failureCode(send("POST", `/api/v1/products/${delivered}/reviews`, { rating: 4, text: "Again", title: null })), "ALREADY_REVIEWED");
    assert.equal(await failureCode(send("POST", `/api/v1/products/${notReceived}/reviews`, { rating: 4, text: "Nope", title: null })), "REVIEW_REQUIRES_PURCHASE");
    assert.equal(await failureCode(send("POST", `/api/v1/products/${delivered}/reviews`, { rating: 9, text: "x" })), "VALIDATION_FAILED");
    const page = (await send("GET", `/api/v1/products/${delivered}/reviews`, undefined, { limit: "2" })) as { reviews: unknown[]; nextCursor: string | null; count: number };
    assert.equal(page.reviews.length, 2);
    assert.ok(page.count >= 2);
    const summary = (await send("GET", `/api/v1/products/${delivered}/rating-summary`)) as { distribution: Record<string, number> };
    assert.ok(summary.distribution["5"]! >= 1);
  });
});
