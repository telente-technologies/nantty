import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createProductInStore, createStoreForSeller } from "./catalogSetup.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface PostBody {
  readonly id: string;
  readonly kind: string;
  readonly liked: boolean;
  readonly author: { readonly id: string } | null;
  readonly counts: { readonly likes: number; readonly comments: number; readonly reposts: number; readonly shares: number };
  readonly repostOf: { readonly id: string } | null;
  readonly products: readonly { readonly id: string }[];
}

async function createTextPost(accessToken: string, text = "Fresh drop this Friday"): Promise<PostBody> {
  const created = await app.client.post("/api/v1/posts").auth(accessToken).send({ text, topics: ["fashion"] }).expect(201);
  return created.json<PostBody>();
}

describe("posts", () => {
  it("creates, reads and deletes a post, and only the author may delete it", async () => {
    const author = await app.registerUser();
    const stranger = await app.registerUser();
    const post = await createTextPost(author.accessToken);
    expect(post).toMatchObject({ kind: "post", author: { id: author.userId }, liked: false, isFollowingAuthor: false, friendsLiked: null, bookmarked: false });

    await app.client.get(`/api/v1/posts/${post.id}`).expect(200).expectJson({ id: post.id });
    await app.client.delete(`/api/v1/posts/${post.id}`).auth(stranger.accessToken).expect(403);
    await app.client.delete(`/api/v1/posts/${post.id}`).auth(author.accessToken).expect(204);
    await app.client.get(`/api/v1/posts/${post.id}`).expect(404);
  });

  it("validates post content by kind", async () => {
    const author = await app.registerUser();
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ kind: "post" }).expect(422);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ kind: "clip", media: [{ url: "https://cdn.example.com/a.jpg", type: "image" }] }).expect(422);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ kind: "clip", media: [{ url: "https://cdn.example.com/a.mp4", type: "video" }] }).expect(201);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ text: "hi", media: [{ type: "image" }] }).expect(422);
    await app.client.post("/api/v1/posts").send({ text: "anonymous" }).expect(401);
  });

  it("keeps likes idempotent and counters accurate", async () => {
    const author = await app.registerUser();
    const fan = await app.registerUser();
    const post = await createTextPost(author.accessToken);
    await app.client.post(`/api/v1/posts/${post.id}/like`).auth(fan.accessToken).expect(200).expectJson({ liked: true, likes: 1 });
    await app.client.post(`/api/v1/posts/${post.id}/like`).auth(fan.accessToken).expect(200).expectJson({ likes: 1 });
    await app.client.delete(`/api/v1/posts/${post.id}/like`).auth(fan.accessToken).expect(200).expectJson({ liked: false, likes: 0 });
    await app.client.delete(`/api/v1/posts/${post.id}/like`).auth(fan.accessToken).expect(200).expectJson({ likes: 0 });
  });

  it("supports comments, replies and comment deletion rules", async () => {
    const author = await app.registerUser();
    const commenter = await app.registerUser();
    const stranger = await app.registerUser();
    const post = await createTextPost(author.accessToken);
    const comment = (await app.client.post(`/api/v1/posts/${post.id}/comments`).auth(commenter.accessToken).send({ text: "Love it" }).expect(201)).json<{ id: string }>();
    const reply = await app.client.post(`/api/v1/posts/${post.id}/comments`).auth(author.accessToken).send({ text: "Thanks!", replyToCommentId: comment.id }).expect(201);
    expect(reply.json<{ replyToCommentId: string }>().replyToCommentId).toBe(comment.id);
    await app.client.post(`/api/v1/posts/${post.id}/comments`).auth(author.accessToken).send({ text: "x", replyToCommentId: post.id }).expect(422);
    await app.client.post(`/api/v1/comments/${comment.id}/like`).auth(author.accessToken).expect(200).expectJson({ liked: true, likes: 1 });
    await app.client.post(`/api/v1/comments/${comment.id}/like`).auth(author.accessToken).expect(200).expectJson({ likes: 1 });
    const withLikes = (await app.client.get(`/api/v1/posts/${post.id}/comments`).auth(author.accessToken).expect(200)).json<{ data: { id: string; likes: number; liked: boolean }[] }>();
    expect(withLikes.data.find((item) => item.id === comment.id)).toMatchObject({ likes: 1, liked: true });
    await app.client.delete(`/api/v1/comments/${comment.id}/like`).auth(author.accessToken).expect(200).expectJson({ liked: false, likes: 0 });

    const listed = await app.client.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    const topLevel = listed.json<{ data: { replyCount: number; previewReplies: unknown[] }[] }>().data;
    expect(topLevel).toHaveLength(1);
    expect(topLevel[0]).toMatchObject({ replyCount: 1, previewReplies: [expect.anything()] });
    await app.client.get(`/api/v1/posts/${post.id}`).expect(200).expectJson({ comments: 2 });

    await app.client.delete(`/api/v1/posts/${post.id}/comments/${comment.id}`).auth(stranger.accessToken).expect(403);
    await app.client.delete(`/api/v1/posts/${post.id}/comments/${comment.id}`).auth(author.accessToken).expect(204);
    await app.client.get(`/api/v1/posts/${post.id}`).expect(200).expectJson({ comments: 1 });
  });

  it("reposts the original post and counts shares", async () => {
    const author = await app.registerUser();
    const fan = await app.registerUser();
    const post = await createTextPost(author.accessToken);
    const repost = (await app.client.post(`/api/v1/posts/${post.id}/repost`).auth(fan.accessToken).send({}).expect(201)).json<PostBody>();
    expect(repost.repostOf?.id).toBe(post.id);
    const repostOfRepost = (await app.client.post(`/api/v1/posts/${repost.id}/repost`).auth(author.accessToken).send({ text: "again" }).expect(201)).json<PostBody>();
    expect(repostOfRepost.repostOf?.id).toBe(post.id);
    await app.client.post(`/api/v1/posts/${post.id}/share`).auth(fan.accessToken).expect(200).expectJson({ shares: 1 });
    await app.client.get(`/api/v1/posts/${post.id}`).expect(200).expectJson({ reposts: 2, shares: 1 });
  });

  it("hides content and blocks interactions between blocked users", async () => {
    const author = await app.registerUser();
    const blocked = await app.registerUser();
    const post = await createTextPost(author.accessToken);
    await app.client.post(`/api/v1/users/${blocked.userId}/block`).auth(author.accessToken).expect(204);
    await app.client.get(`/api/v1/posts/${post.id}`).auth(blocked.accessToken).expect(404);
    await app.client.post(`/api/v1/posts/${post.id}/like`).auth(blocked.accessToken).expect(404);
    await app.client.get(`/api/v1/users/${author.userId}/posts`).auth(blocked.accessToken).expect(404);
  });

  it("lists a user's posts by kind", async () => {
    const author = await app.registerUser();
    await createTextPost(author.accessToken);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ kind: "clip", media: [{ url: "https://cdn.example.com/clip.mp4", type: "video" }] }).expect(201);
    const posts = await app.client.get(`/api/v1/users/${author.userId}/posts`).expect(200);
    expect(posts.json<{ data: PostBody[] }>().data).toHaveLength(2);
    const clips = await app.client.get(`/api/v1/users/${author.userId}/posts`).query({ kind: "clip" }).expect(200);
    expect(clips.json<{ data: PostBody[] }>().data.map((item) => item.kind)).toEqual(["clip"]);
  });
});

describe("stories", () => {
  it("shows active stories from followed users and expires them after 24 hours", async () => {
    const author = await app.registerUser();
    const follower = await app.registerUser();
    await app.client.post(`/api/v1/users/${author.userId}/follow`).auth(follower.accessToken).expect(200);
    const story = (await app.client.post("/api/v1/stories").auth(author.accessToken).send({ media: [{ url: "https://cdn.example.com/s.jpg", type: "image" }] }).expect(201)).json<{ id: string }>();
    const tray = (await app.client.get("/api/v1/stories/tray").auth(follower.accessToken).expect(200)).json<{ author: { id: string }; hasUnseen: boolean; stories: unknown[] }[]>();
    expect(tray.find((entry) => entry.author.id === author.userId)).toMatchObject({ hasUnseen: true, stories: [{ id: story.id, seen: false }] });
    await app.client.post(`/api/v1/stories/${story.id}/seen`).auth(follower.accessToken).expect(200);
    const afterSeen = (await app.client.get(`/api/v1/users/${author.userId}/stories`).auth(follower.accessToken).expect(200)).json<{ id: string; seen: boolean }[]>();
    expect(afterSeen).toEqual([expect.objectContaining({ id: story.id, seen: true })]);
    const reply = await app.client.post(`/api/v1/stories/${story.id}/replies`).auth(follower.accessToken).send({ text: "Love this" }).expect(201);
    const conversationId = reply.json<{ conversationId: string }>().conversationId;
    const messages = (await app.client.get(`/api/v1/conversations/${conversationId}/messages`).auth(author.accessToken).expect(200)).json<{ data: { text: string }[] }>();
    expect(messages.data[0]?.text).toContain("Love this");

    app.clock.advanceBySeconds(24 * 3600 + 1);
    const refreshed = await app.client.post("/api/v1/auth/refresh").send({ refreshToken: follower.refreshToken }).expect(200);
    const accessToken = refreshed.json<{ accessToken: string }>().accessToken;
    const expired = await app.client.get("/api/v1/stories/tray").auth(accessToken).expect(200);
    expect(expired.json<unknown[]>()).toHaveLength(0);
  });
});

describe("tagged products", () => {
  it("tags published products and rejects unpublished ones", async () => {
    const seller = await app.registerSeller();
    const storeId = await createStoreForSeller(app, seller, "Tag Store");
    const published = await createProductInStore(app, seller, storeId);
    const draft = await createProductInStore(app, seller, storeId, { publish: false, title: "Draft Bag" });
    const post = (await app.client.post("/api/v1/posts").auth(seller.accessToken).send({ text: "New in", productIds: [published], storeId }).expect(201)).json<PostBody>();
    expect(post.products.map((product) => product.id)).toEqual([published]);
    await app.client.post("/api/v1/posts").auth(seller.accessToken).send({ text: "Nope", productIds: [draft] }).expect(422);
    const outsider = await app.registerUser();
    await app.client.post("/api/v1/posts").auth(outsider.accessToken).send({ text: "Not mine", storeId }).expect(403);
    const storePosts = await app.client.get(`/api/v1/stores/${storeId}/posts`).expect(200);
    expect(storePosts.json<{ data: PostBody[] }>().data.map((item) => item.id)).toEqual([post.id]);
  });
});

describe("tagged product prices", () => {
  it("shows a GB viewer GBP prices for products from an NGN store", async () => {
    const seller = await app.registerSeller();
    const created = await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name: "Lagos Prices", currency: "NGN" }).expect(201);
    const storeId = created.json<{ id: string }>().id;
    const productId = await createProductInStore(app, seller, storeId);
    const post = (await app.client.post("/api/v1/posts").auth(seller.accessToken).send({ text: "Priced", productIds: [productId] }).expect(201)).json<PostBody>();

    const naira = await app.client.get(`/api/v1/posts/${post.id}`).set("x-client-region", "NG").expect(200);
    expect(naira.json<{ products: { price: { amountMinor: number; currency: string } }[] }>().products[0]?.price).toEqual({
      amountMinor: 1_500_000,
      currency: "NGN",
    });
    const pounds = await app.client.get(`/api/v1/posts/${post.id}`).set("x-client-region", "GB").expect(200);
    const price = pounds.json<{ products: { price: { amountMinor: number; currency: string } }[] }>().products[0]?.price;
    expect(price?.currency).toBe("GBP");
    expect(price?.amountMinor).toBeGreaterThan(0);
    expect(price?.amountMinor).toBeLessThan(1_500_000);
  });
});
