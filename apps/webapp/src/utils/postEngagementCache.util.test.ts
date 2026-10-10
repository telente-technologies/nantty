import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { addRepostEverywhere, currentLikedState, resetPostLikeSyncForTests, setPostLiked, type LikeSender } from "./postEngagementCache.util";

const FEED_KEY = ["feed", "for-you", null];
const PROFILE_KEY = ["profile", "posts", "u_1"];
const DETAIL_KEY = ["post", "p_1"];

type CachedPost = { id: string; liked: boolean; likes: number; reposts: number };
const buildPost = (overrides: Partial<CachedPost> = {}): CachedPost => ({ id: "p_1", liked: false, likes: 10, reposts: 2, ...overrides });

let client: QueryClient;
let sent: [string, boolean][];
let failures: unknown[];
let nextFailure: unknown;
let pendingRelease: (() => void) | null;

const sender: LikeSender = {
  send: (postId, liked) => {
    sent.push([postId, liked]);
    if (nextFailure) {
      const failure = nextFailure;
      nextFailure = undefined;
      return Promise.reject(failure);
    }
    if (pendingRelease === null) return Promise.resolve();
    return new Promise<void>((resolve) => {
      pendingRelease = resolve;
    });
  },
  onFailed: (error) => failures.push(error),
};

const feedPost = () => client.getQueryData<{ pages: { data: CachedPost[] }[] }>(FEED_KEY)!.pages[0]!.data[1]!;
const profilePost = () => client.getQueryData<{ data: CachedPost[] }>(PROFILE_KEY)!.data[0]!;
const detailPost = () => client.getQueryData<CachedPost>(DETAIL_KEY)!;

describe("post engagement cache", () => {
  beforeEach(() => {
    client = new QueryClient();
    sent = [];
    failures = [];
    nextFailure = undefined;
    pendingRelease = null;
    resetPostLikeSyncForTests();
    client.setQueryData(FEED_KEY, { pages: [{ data: [buildPost({ id: "p_other" }), buildPost()], nextCursor: null }], pageParams: [null] });
    client.setQueryData(PROFILE_KEY, { data: [buildPost()], nextCursor: null });
    client.setQueryData(DETAIL_KEY, buildPost());
  });

  it("a like on the profile reaches the feed and the post page", async () => {
    await setPostLiked(client, "p_1", true, false, sender);
    for (const post of [feedPost(), profilePost(), detailPost()]) assert.deepEqual([post.liked, post.likes], [true, 11]);
    assert.deepEqual(sent, [["p_1", true]]);
  });

  it("rolls back every copy when the request fails", async () => {
    nextFailure = new Error("offline");
    await setPostLiked(client, "p_1", true, false, sender);
    for (const post of [feedPost(), profilePost(), detailPost()]) assert.deepEqual([post.liked, post.likes], [false, 10]);
    assert.equal(failures.length, 1);
  });

  it("a double tap sends one like", async () => {
    await Promise.all([setPostLiked(client, "p_1", true, false, sender), setPostLiked(client, "p_1", true, false, sender)]);
    assert.deepEqual(sent, [["p_1", true]]);
    assert.equal(feedPost().likes, 11);
  });

  it("like then unlike quickly sends both in order and ends unliked", async () => {
    pendingRelease = () => undefined;
    const first = setPostLiked(client, "p_1", true, false, sender);
    const second = setPostLiked(client, "p_1", !currentLikedState(client, "p_1", false), false, sender);
    assert.equal(feedPost().liked, false);
    pendingRelease();
    pendingRelease = null;
    await Promise.all([first, second]);
    assert.deepEqual(sent, [["p_1", true], ["p_1", false]]);
    assert.deepEqual([feedPost().liked, feedPost().likes], [false, 10]);
  });

  it("counts a repost on every copy", () => {
    addRepostEverywhere(client, "p_1");
    assert.deepEqual([feedPost().reposts, profilePost().reposts, detailPost().reposts], [3, 3, 3]);
    assert.equal(client.getQueryData<{ pages: { data: CachedPost[] }[] }>(FEED_KEY)!.pages[0]!.data[0]!.reposts, 2);
  });
});
