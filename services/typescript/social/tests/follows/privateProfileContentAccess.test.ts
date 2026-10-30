import { describe, expect, it } from "vitest";

import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";
import { createListFollowersHandler } from "../../src/modules/follows/queries/listFollowers/listFollowers.handler.js";
import { createListFollowingHandler } from "../../src/modules/follows/queries/listFollowing/listFollowing.handler.js";
import { createGetPostHandler } from "../../src/modules/posts/queries/getPost/getPost.handler.js";
import { createGetStoryRingStatusHandler } from "../../src/modules/posts/queries/getStoryRingStatus/getStoryRingStatus.handler.js";
import { createListUserPostsHandler } from "../../src/modules/posts/queries/listUserPosts/listUserPosts.handler.js";
import { createListUserStoriesHandler } from "../../src/modules/posts/queries/listUserStories/listUserStories.handler.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { buildPostRow } from "../posts/socialPostFakes.fake.js";

const ownerId = "0192f0a0-0000-7000-8000-00000000a001";
const followerId = "0192f0a0-0000-7000-8000-00000000b001";
const requesterId = "0192f0a0-0000-7000-8000-00000000c001";
const strangerId = "0192f0a0-0000-7000-8000-00000000d001";
const postId = "0192f0a0-0000-7000-8000-0000000000a1";
const clipId = "0192f0a0-0000-7000-8000-0000000000a2";
const storyId = "0192f0a0-0000-7000-8000-0000000000a3";
const subscriberPostId = "0192f0a0-0000-7000-8000-0000000000a4";
const subscriberClipId = "0192f0a0-0000-7000-8000-0000000000a5";

type ViewerName = "owner" | "acceptedFollower" | "pendingRequester" | "stranger" | "guest";
const viewers: Readonly<Record<ViewerName, string | undefined>> = { owner: ownerId, acceptedFollower: followerId, pendingRequester: requesterId, stranger: strangerId, guest: undefined };

function privateWorld() {
  const store = createMemoryStore({
    posts: [
      buildPostRow({ id: postId, authorId: ownerId, text: "Private post" }) as unknown as Row,
      buildPostRow({ id: clipId, authorId: ownerId, kind: "clip", text: "Private clip" }) as unknown as Row,
      buildPostRow({ id: subscriberPostId, authorId: ownerId, text: "Members-only post", visibility: "subscribers" }) as unknown as Row,
      buildPostRow({ id: subscriberClipId, authorId: ownerId, kind: "clip", text: "Members-only clip", visibility: "subscribers" }) as unknown as Row,
      buildPostRow({ id: storyId, authorId: ownerId, kind: "story", text: "", expiresAt: new Date("2026-10-11T12:00:00Z"), media: [{ type: "image", url: "https://cdn.test/story.webp", posterUrl: null }] as never }) as unknown as Row,
    ],
    postDefaults: () => ({ ...buildPostRow({}), id: undefined }),
  });
  store.privateAccountIds.add(ownerId);
  store.follows.push({ id: "f-accepted", followerId, followeeId: ownerId, state: "accepted", postNotifications: "off", createdAt: new Date(), respondedAt: new Date() });
  store.follows.push({ id: "f-pending", followerId: requesterId, followeeId: ownerId, state: "requested", postNotifications: "off", createdAt: new Date(), respondedAt: null });
  store.follows.push({ id: "f-owner-follows", followerId: ownerId, followeeId: strangerId, state: "accepted", postNotifications: "off", createdAt: new Date(), respondedAt: new Date() });
  const context = store.context;
  const endpoints = {
    userPosts: (viewerId: string | undefined) => createListUserPostsHandler(context)({ viewerId, ownerId, cursor: undefined, limit: 20, kind: "post" }),
    subscriberPosts: (viewerId: string | undefined) => createListUserPostsHandler(context)({ viewerId, ownerId, cursor: undefined, limit: 20, kind: undefined, visibility: "subscribers" }),
    userClips: (viewerId: string | undefined) => createListUserPostsHandler(context)({ viewerId, ownerId, cursor: undefined, limit: 20, kind: "clip" }),
    userStories: (viewerId: string | undefined) => createListUserStoriesHandler(context)({ viewerId, ownerId }),
    followers: (viewerId: string | undefined) => createListFollowersHandler(context)({ viewerId, ownerId, searchTerm: undefined, cursor: undefined, limit: 20 }),
    following: (viewerId: string | undefined) => createListFollowingHandler(context)({ viewerId, ownerId, searchTerm: undefined, cursor: undefined, limit: 20 }),
    postDetail: (viewerId: string | undefined) => createGetPostHandler(context)({ viewerId, postId }),
    postComments: (viewerId: string | undefined) => createListPostCommentsHandler(context)({ viewerId, postId, cursor: undefined, limit: 20 }),
  } as const;
  return { store, endpoints, storyRing: (viewerId: string | undefined) => createGetStoryRingStatusHandler(context)({ viewerId, ownerId }) };
}

const endpointNames = ["userPosts", "userClips", "userStories", "followers", "following", "postDetail", "postComments"] as const;

describe("server-side enforcement of a private profile", () => {
  for (const endpoint of endpointNames) {
    for (const viewer of ["pendingRequester", "stranger", "guest"] as const) {
      it(`${endpoint} is refused with 403 for a ${viewer}`, async () => {
        const { endpoints } = privateWorld();
        await expect(endpoints[endpoint](viewers[viewer])).rejects.toMatchObject({ status: 403, code: "ACCOUNT_PRIVATE" });
      });
    }
    for (const viewer of ["owner", "acceptedFollower"] as const) {
      it(`${endpoint} works for the ${viewer}`, async () => {
        const { endpoints } = privateWorld();
        await expect(endpoints[endpoint](viewers[viewer])).resolves.toBeDefined();
      });
    }
    it(`${endpoint} is closed to an accepted follower the owner later blocked`, async () => {
      const { store, endpoints } = privateWorld();
      store.blocks.push({ blockerId: ownerId, blockedId: followerId });
      await expect(endpoints[endpoint](followerId)).rejects.toMatchObject({ status: 404 });
    });
    it(`${endpoint} is closed to an accepted follower who blocked the owner`, async () => {
      const { store, endpoints } = privateWorld();
      store.blocks.push({ blockerId: followerId, blockedId: ownerId });
      await expect(endpoints[endpoint](followerId)).rejects.toMatchObject({ status: 404 });
    });
  }

  it("returns the real content to the accepted follower and the owner", async () => {
    const { endpoints } = privateWorld();
    expect((await endpoints.userPosts(followerId)).data.map((post) => post.id)).toEqual([postId]);
    expect((await endpoints.userClips(ownerId)).data.map((post) => post.id)).toEqual([clipId]);
    expect((await endpoints.userStories(followerId)).map((story) => story.id)).toEqual([storyId]);
    expect((await endpoints.followers(followerId)).data.map((entry) => entry.id)).toEqual([followerId]);
    expect((await endpoints.following(ownerId)).data.map((entry) => entry.id)).toEqual([strangerId]);
  });

  it("separates subscriber posts and clips from the public profile timeline and masks them for non-subscribers", async () => {
    const { endpoints } = privateWorld();
    const regularPosts = await endpoints.userPosts(followerId);
    expect(regularPosts.data.map((post) => post.id)).toEqual([postId]);
    const subscriberPosts = await endpoints.subscriberPosts(followerId);
    expect(subscriberPosts.data.map((post) => post.id)).toEqual([subscriberClipId, subscriberPostId]);
    expect(subscriberPosts.data.every((post) => post.subscriberOnly && post.viewerHasAccess === false)).toBe(true);
    expect(subscriberPosts.data.every((post) => post.text === "" && post.media.length === 0)).toBe(true);
    const ownerPosts = await endpoints.subscriberPosts(ownerId);
    expect(ownerPosts.data.every((post) => post.viewerHasAccess === true)).toBe(true);
    expect(ownerPosts.data.map((post) => post.text)).toEqual(["Members-only clip", "Members-only post"]);
  });

  it("hides the story ring from everyone the content is hidden from", async () => {
    const { store, storyRing } = privateWorld();
    for (const viewerId of [requesterId, strangerId, undefined]) expect((await storyRing(viewerId)).hasActiveStory).toBe(false);
    expect((await storyRing(followerId)).hasActiveStory).toBe(true);
    store.blocks.push({ blockerId: followerId, blockedId: ownerId });
    expect((await storyRing(followerId)).hasActiveStory).toBe(false);
  });

  it("opens everything once the account is public, except to blocked pairs", async () => {
    const { store, endpoints } = privateWorld();
    store.privateAccountIds.clear();
    await expect(endpoints.userPosts(strangerId)).resolves.toBeDefined();
    await expect(endpoints.followers(undefined)).resolves.toBeDefined();
    store.blocks.push({ blockerId: strangerId, blockedId: ownerId });
    await expect(endpoints.userPosts(strangerId)).rejects.toMatchObject({ status: 404 });
    await expect(endpoints.postDetail(strangerId)).rejects.toMatchObject({ status: 404 });
  });
});
