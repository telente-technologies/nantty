import { QueryClient, type InfiniteData } from "@tanstack/react-query";

import { ApiError } from "@/errors/api.error";
import type { Page, Post } from "@/types";

import { resetPostLikeSyncForTests, setPostLiked, togglePostLiked } from "../postLikeSync.util";
import { setFollowingAuthorEverywhere } from "../postEngagementCache.util";

const mockLikePost = jest.fn<Promise<void>, [string]>();
const mockUnlikePost = jest.fn<Promise<void>, [string]>();
const mockShowToast = jest.fn();

jest.mock("@/services/content/posts.service", () => ({
  postsService: { likePost: (id: string) => mockLikePost(id), unlikePost: (id: string) => mockUnlikePost(id) },
}));
jest.mock("@/store/toast.store", () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));

const FEED_KEY = ["feed", "for-you", null];
const PROFILE_KEY = ["users", "author-1", "posts"];
const DETAIL_KEY = ["post", "post-1"];
const SAVED_KEY = ["saves", "post"];

const buildPost = (overrides: Partial<Post> = {}) =>
  ({ id: "post-1", liked: false, likes: 10, reposts: 0, isFollowingAuthor: false, author: { id: "author-1", name: "Ada" }, ...overrides }) as unknown as Post;

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let client: QueryClient;

const seedEveryCache = (post: Post) => {
  client.setQueryData<InfiniteData<Page<Post>>>(FEED_KEY, { pages: [{ data: [buildPost({ id: "other" }), post], nextCursor: null }], pageParams: [null] });
  client.setQueryData<Page<Post>>(PROFILE_KEY, { data: [post], nextCursor: null });
  client.setQueryData<Post>(DETAIL_KEY, post);
  client.setQueryData(SAVED_KEY, { data: [{ id: "saved-1", post }], nextCursor: null });
};

const feedPost = () => client.getQueryData<InfiniteData<Page<Post>>>(FEED_KEY)!.pages[0]!.data[1]!;
const profilePost = () => client.getQueryData<Page<Post>>(PROFILE_KEY)!.data[0]!;
const detailPost = () => client.getQueryData<Post>(DETAIL_KEY)!;
const savedPost = () => client.getQueryData<{ data: { post: Post }[] }>(SAVED_KEY)!.data[0]!.post;
const everyCopy = () => [feedPost(), profilePost(), detailPost(), savedPost()];

describe("shared post like sync", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    mockLikePost.mockReset().mockResolvedValue(undefined);
    mockUnlikePost.mockReset().mockResolvedValue(undefined);
    mockShowToast.mockReset();
    resetPostLikeSyncForTests();
    seedEveryCache(buildPost());
  });
  afterEach(() => client.clear());

  it("a like from the profile updates the feed, detail and saved copies", async () => {
    await togglePostLiked(client, profilePost());
    for (const post of everyCopy()) expect(post).toMatchObject({ liked: true, likes: 11 });
    expect(mockLikePost).toHaveBeenCalledTimes(1);
  });

  it("a like from the feed updates the profile copy", async () => {
    await togglePostLiked(client, feedPost());
    expect(profilePost()).toMatchObject({ liked: true, likes: 11 });
  });

  it("leaves unrelated posts untouched", async () => {
    const other = client.getQueryData<InfiniteData<Page<Post>>>(FEED_KEY)!.pages[0]!.data[0];
    await togglePostLiked(client, feedPost());
    expect(client.getQueryData<InfiniteData<Page<Post>>>(FEED_KEY)!.pages[0]!.data[0]).toBe(other);
  });

  it("rolls every copy back and explains when the server refuses", async () => {
    mockLikePost.mockRejectedValueOnce(new ApiError(500, "boom"));
    await togglePostLiked(client, profilePost());
    for (const post of everyCopy()) expect(post).toMatchObject({ liked: false, likes: 10 });
    expect(mockShowToast).toHaveBeenCalledWith("Couldn't update your like. Try again.", { tone: "error" });
  });

  it("says the post is gone when it was deleted", async () => {
    mockLikePost.mockRejectedValueOnce(new ApiError(404, "gone"));
    await togglePostLiked(client, feedPost());
    expect(feedPost()).toMatchObject({ liked: false, likes: 10 });
    expect(mockShowToast).toHaveBeenCalledWith("This post isn't available anymore.", { tone: "error" });
  });

  it("a double tap on like sends one request and counts once", async () => {
    const stale = feedPost();
    await Promise.all([setPostLiked(client, stale, true), setPostLiked(client, stale, true)]);
    expect(mockLikePost).toHaveBeenCalledTimes(1);
    expect(feedPost()).toMatchObject({ liked: true, likes: 11 });
  });

  it("toggling twice from a stale prop reads the cache and unlikes", async () => {
    const stale = feedPost();
    await togglePostLiked(client, stale);
    await togglePostLiked(client, stale);
    expect(mockLikePost).toHaveBeenCalledTimes(1);
    expect(mockUnlikePost).toHaveBeenCalledTimes(1);
    expect(feedPost()).toMatchObject({ liked: false, likes: 10 });
  });

  it("like then unlike quickly ends unliked and sends the requests in order", async () => {
    const likeRequest = deferred();
    mockLikePost.mockReturnValueOnce(likeRequest.promise);
    const first = togglePostLiked(client, feedPost());
    const second = togglePostLiked(client, feedPost());
    expect(feedPost()).toMatchObject({ liked: false, likes: 10 });
    expect(mockUnlikePost).not.toHaveBeenCalled();
    likeRequest.resolve();
    await Promise.all([first, second]);
    expect(mockUnlikePost).toHaveBeenCalledTimes(1);
    expect(feedPost()).toMatchObject({ liked: false, likes: 10 });
  });

  it("like, unlike and like again before the first answer sends nothing extra", async () => {
    const likeRequest = deferred();
    mockLikePost.mockReturnValueOnce(likeRequest.promise);
    const calls = [togglePostLiked(client, feedPost()), togglePostLiked(client, feedPost()), togglePostLiked(client, feedPost())];
    likeRequest.resolve();
    await Promise.all(calls);
    expect(mockLikePost).toHaveBeenCalledTimes(1);
    expect(mockUnlikePost).not.toHaveBeenCalled();
    expect(feedPost()).toMatchObject({ liked: true, likes: 11 });
  });

  it("keeps the like when the request is queued offline", async () => {
    mockLikePost.mockResolvedValueOnce(undefined);
    await togglePostLiked(client, detailPost());
    for (const post of everyCopy()) expect(post).toMatchObject({ liked: true, likes: 11 });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("never shows a negative count", async () => {
    seedEveryCache(buildPost({ liked: true, likes: 0 }));
    await togglePostLiked(client, feedPost());
    expect(feedPost()).toMatchObject({ liked: false, likes: 0 });
  });

  it("follow state reaches every post by the author", () => {
    setFollowingAuthorEverywhere(client, "author-1", true);
    for (const post of everyCopy()) expect(post.isFollowingAuthor).toBe(true);
    expect(client.getQueryData<InfiniteData<Page<Post>>>(FEED_KEY)!.pages[0]!.data[0]!.isFollowingAuthor).toBe(true);
  });
});
