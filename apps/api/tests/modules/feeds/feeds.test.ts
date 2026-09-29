import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface FeedItemBody {
  readonly id: string;
  readonly kind: string;
  readonly isFollowingAuthor: boolean;
  readonly friendsLiked: { readonly count: number; readonly avatars: readonly (string | null)[] } | null;
}

interface FeedPageBody {
  readonly data: readonly FeedItemBody[];
  readonly nextCursor: string | null;
}

async function findTopicId(slug: string): Promise<string> {
  const topics = (await app.client.get("/api/v1/topics").expect(200)).json<{ id: string; slug: string }[]>();
  return topics.find((topic) => topic.slug === slug)?.id ?? "";
}

async function createPost(accessToken: string, body: Record<string, unknown>): Promise<string> {
  return (await app.client.post("/api/v1/posts").auth(accessToken).send(body).expect(201)).json<{ id: string }>().id;
}

describe("feeds", () => {
  it("builds the following feed with friends-liked social proof", async () => {
    const viewer = await app.registerUser();
    const creator = await app.registerUser();
    const friend = await app.registerUser();
    const stranger = await app.registerUser();
    await app.client.post(`/api/v1/users/${creator.userId}/follow`).auth(viewer.accessToken).expect(200);
    await app.client.post(`/api/v1/users/${friend.userId}/follow`).auth(viewer.accessToken).expect(200);
    const followedPost = await createPost(creator.accessToken, { text: "From someone I follow" });
    await createPost(stranger.accessToken, { text: "From a stranger" });
    await app.client.post(`/api/v1/posts/${followedPost}/like`).auth(friend.accessToken).expect(200);

    const feed = (await app.client.get("/api/v1/feeds/following").auth(viewer.accessToken).expect(200)).json<FeedPageBody>();
    expect(feed.data.map((item) => item.id)).toEqual([followedPost]);
    expect(feed.data[0]).toMatchObject({ isFollowingAuthor: true, friendsLiked: { count: 1 } });
  });

  it("ranks the For You feed, filters by topic chip and hides blocked authors", async () => {
    const viewer = await app.registerUser();
    const fashion = await app.registerUser();
    const blocked = await app.registerUser();
    const fashionPost = await createPost(fashion.accessToken, { text: "Ankara looks", topics: ["fashion"] });
    const techPost = await createPost(fashion.accessToken, { text: "New phone", topics: ["tech"] });
    const blockedPost = await createPost(blocked.accessToken, { text: "Hidden", topics: ["fashion"] });
    await app.client.post(`/api/v1/users/${blocked.userId}/block`).auth(viewer.accessToken).expect(204);

    const all = (await app.client.get("/api/v1/feeds/for-you").auth(viewer.accessToken).expect(200)).json<FeedPageBody>();
    const ids = all.data.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([fashionPost, techPost]));
    expect(ids).not.toContain(blockedPost);

    const filtered = (await app.client.get("/api/v1/feeds/for-you").query({ topicId: await findTopicId("fashion") }).auth(viewer.accessToken).expect(200)).json<FeedPageBody>();
    expect(filtered.data.map((item) => item.id)).toContain(fashionPost);
    expect(filtered.data.map((item) => item.id)).not.toContain(techPost);
    await app.client.get("/api/v1/feeds/for-you").expect(401);
  });

  it("pages through the For You feed without repeating posts", async () => {
    const viewer = await app.registerUser();
    const creator = await app.registerUser();
    for (let index = 0; index < 5; index += 1) await createPost(creator.accessToken, { text: `Post ${index}`, topics: ["music"] });
    const topicId = await findTopicId("music");
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: Record<string, string> = cursor === null ? { topicId, limit: "2" } : { topicId, limit: "2", cursor };
      const page: FeedPageBody = (await app.client.get("/api/v1/feeds/for-you").query(query).auth(viewer.accessToken).expect(200)).json<FeedPageBody>();
      seen.push(...page.data.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("suggests clips only and records interactions", async () => {
    const viewer = await app.registerUser();
    const creator = await app.registerUser();
    const clip = await createPost(creator.accessToken, { kind: "clip", media: [{ url: "https://cdn.example.com/c.mp4", type: "video" }] });
    const clips = (await app.client.get("/api/v1/clips").query({ tab: "forYou" }).auth(viewer.accessToken).expect(200)).json<FeedPageBody>();
    expect(clips.data.every((item) => item.kind === "clip")).toBe(true);
    expect(clips.data.map((item) => item.id)).toContain(clip);
    const suggested = (await app.client.get("/api/v1/feeds/suggested-clips").auth(viewer.accessToken).expect(200)).json<{ id: string; thumbnailUrl: string | null }[]>();
    expect(suggested.find((item) => item.id === clip)).toMatchObject({ thumbnailUrl: "https://cdn.example.com/c.mp4" });

    await app.client.post("/api/v1/feeds/interactions").auth(viewer.accessToken).send({ postId: clip, kind: "view" }).expect(204);
    await app.client.get(`/api/v1/posts/${clip}`).expect(200).expectJson({ views: 1 });
    await app.client.post("/api/v1/feeds/interactions").auth(viewer.accessToken).send({ postId: clip, kind: "teleport" }).expect(400);
  });
});
