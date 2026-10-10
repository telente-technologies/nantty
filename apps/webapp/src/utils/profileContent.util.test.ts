import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Post } from "@/types";
import { filterPostsForProfileTab, profileTabEmptyTitle, sortPinnedPostsFirst } from "./profileContent.util";

function buildPost(overrides: Partial<Post> & { readonly id: string }): Post {
  return {
    kind: "post",
    author: { id: "u_1", name: "Ada", username: "ada", avatarUrl: null, verified: false },
    createdAt: "2026-01-01T00:00:00.000Z",
    text: "hello",
    media: [],
    likes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
    liked: false,
    bookmarked: false,
    isFollowingAuthor: false,
    friendsLiked: null,
    products: [],
    ...overrides,
  } as Post;
}

describe("filterPostsForProfileTab", () => {
  const posts = [
    buildPost({ id: "plain" }),
    buildPost({ id: "clip", kind: "clip" }),
    buildPost({ id: "quote", isQuote: true }),
    buildPost({ id: "with-media", media: [{ type: "image", url: "https://example.com/a.jpg" }] }),
  ];

  it("keeps every post on the posts tab", () => {
    assert.deepEqual(filterPostsForProfileTab(posts, "posts").map((post) => post.id), ["plain", "clip", "quote", "with-media"]);
  });

  it("keeps only clips on the clips tab", () => {
    assert.deepEqual(filterPostsForProfileTab(posts, "clips").map((post) => post.id), ["clip"]);
  });

  it("keeps only quotes and reshares on the reposts tab", () => {
    const withReshare = [...posts, buildPost({ id: "reshare", resharedFrom: buildPost({ id: "original" }) })];
    assert.deepEqual(filterPostsForProfileTab(withReshare, "reposts").map((post) => post.id), ["quote", "reshare"]);
  });
  it("keeps every post on the media tab", () => {
    assert.deepEqual(filterPostsForProfileTab(posts, "media").map((post) => post.id), ["plain", "clip", "quote", "with-media"]);
  });
});

describe("sortPinnedPostsFirst", () => {
  it("moves pinned posts to the front, most recently pinned first, without dropping any", () => {
    const posts = [
      buildPost({ id: "a" }),
      buildPost({ id: "b", isPinned: true, pinnedAt: "2026-10-01T00:00:00.000Z" }),
      buildPost({ id: "c", isPinned: true, pinnedAt: "2026-10-02T00:00:00.000Z" }),
      buildPost({ id: "d" }),
    ];
    assert.deepEqual(sortPinnedPostsFirst(posts).map((post) => post.id), ["c", "b", "a", "d"]);
  });

  it("does not mutate the input array", () => {
    const posts = [buildPost({ id: "a" }), buildPost({ id: "b", isPinned: true })];
    sortPinnedPostsFirst(posts);
    assert.deepEqual(posts.map((post) => post.id), ["a", "b"]);
  });
});

describe("profileTabEmptyTitle", () => {
  it("covers self and visitor wording per tab", () => {
    assert.equal(profileTabEmptyTitle("posts", true, "Ada"), "No posts yet");
    assert.equal(profileTabEmptyTitle("posts", false, "Ada"), "Ada hasn't posted yet.");
    assert.equal(profileTabEmptyTitle("clips", true, "Ada"), "No clips yet");
    assert.equal(profileTabEmptyTitle("reposts", false, "Ada"), "Ada hasn't reposted anything yet.");
    assert.equal(profileTabEmptyTitle("media", false, "Ada"), "No photos or videos yet");
  });
});
