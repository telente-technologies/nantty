import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { resetPostLikeSyncForTests } from "@/cache/postLikeSync.util";
import type { Page, Post } from "@/types";

import { usePostInteractions } from "../usePostInteractions.hook";

const mockLikePost = jest.fn(async (_postId: string) => undefined);
const mockRepostPost = jest.fn(async (_postId: string, _text?: string) => ({ id: "repost-1", liked: false, likes: 0, reposts: 0 }));
const mockSignedIn = { current: true };
const mockOpenSignInPrompt = jest.fn();

jest.mock("@/services/content/posts.service", () => ({
  postsService: {
    likePost: (id: string) => mockLikePost(id),
    unlikePost: jest.fn(async () => undefined),
    repostPost: (id: string, text?: string) => mockRepostPost(id, text),
    followPostAuthor: jest.fn(async () => undefined),
    recordPostShare: jest.fn(async () => undefined),
  },
}));
jest.mock("@/store/toast.store", () => ({ showToast: jest.fn() }));
jest.mock("@/config/webAppLinks.config", () => ({ webAppLinks: { post: (id: string) => `https://zudomart.test/post/${id}` } }));
jest.mock("@/utils/requireAuth.util", () => ({
  requireAuthThen: (action: () => unknown, _returnTo: unknown, reason: string) => {
    if (!mockSignedIn.current) {
      mockOpenSignInPrompt(reason);
      return false;
    }
    void action();
    return true;
  },
}));

const PROFILE_KEY = ["users", "author-1", "posts"];
const post = { id: "post-1", liked: false, likes: 3, reposts: 1, isFollowingAuthor: false, author: { id: "author-1", name: "Ada" } } as unknown as Post;

let client: QueryClient;

function renderInteractions() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData<Page<Post>>(PROFILE_KEY, { data: [post], nextCursor: null });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook(() => usePostInteractions(), { wrapper });
}

const profilePost = () => client.getQueryData<Page<Post>>(PROFILE_KEY)!.data[0]!;

describe("usePostInteractions", () => {
  beforeEach(() => {
    mockSignedIn.current = true;
    mockLikePost.mockClear();
    mockOpenSignInPrompt.mockClear();
    resetPostLikeSyncForTests();
  });
  afterEach(() => client.clear());

  it("likes a post shown on a profile, not only in the feed", async () => {
    const { result } = await renderInteractions();
    await act(async () => {
      result.current.togglePostLike(post);
    });
    expect(profilePost()).toMatchObject({ liked: true, likes: 4 });
    expect(mockLikePost).toHaveBeenCalledWith("post-1");
  });

  it("asks a signed-out viewer to sign in and changes nothing", async () => {
    mockSignedIn.current = false;
    const { result } = await renderInteractions();
    await act(async () => {
      result.current.togglePostLike(post);
      result.current.followPostAuthor(post);
    });
    expect(mockOpenSignInPrompt).toHaveBeenCalledWith("like posts");
    expect(mockOpenSignInPrompt).toHaveBeenCalledWith("follow creators");
    expect(mockLikePost).not.toHaveBeenCalled();
    expect(profilePost()).toMatchObject({ liked: false, likes: 3, isFollowingAuthor: false });
  });

  it("follows the author everywhere the post is cached", async () => {
    const { result } = await renderInteractions();
    await act(async () => {
      result.current.followPostAuthor(post);
    });
    expect(profilePost().isFollowingAuthor).toBe(true);
  });

  it("counts a repost on every cached copy", async () => {
    const { result } = await renderInteractions();
    await act(async () => {
      await result.current.resharePost(post);
    });
    expect(profilePost().reposts).toBe(2);
    expect(mockRepostPost).toHaveBeenCalledWith("post-1", undefined);
  });
});
