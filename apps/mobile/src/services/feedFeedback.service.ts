import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { ID, Page, Post } from "@/types";

import { api } from "./apiClient.service";

export type FeedFeedbackType = "hide" | "not_interested";

export const feedFeedbackService = {
  sendFeedFeedbackForPost: (postId: ID, type: FeedFeedbackType) => api.post<void>("/api/v1/feeds/feedback", { postId, kind: type === "not_interested" ? "notInterested" : "hide" }),
};

const FEED_QUERY_KEY_PREFIXES_THAT_LIST_POSTS = [["feed"], ["clips"]] as const;

type CachedFeedData = InfiniteData<Page<Post>> | Page<Post> | readonly Post[] | undefined;

const removePostFromCachedFeedData = (data: CachedFeedData, postId: ID): CachedFeedData => {
  if (!data) return data;
  if (Array.isArray(data)) return data.filter((post) => post.id !== postId);
  if ("pages" in data) return { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((post) => post.id !== postId) })) };
  if ("data" in data) return { ...data, data: data.data.filter((post) => post.id !== postId) };
  return data;
};

export function hidePostFromAllCachedFeeds(queryClient: QueryClient, postId: ID) {
  const snapshots = FEED_QUERY_KEY_PREFIXES_THAT_LIST_POSTS.flatMap((prefix) => queryClient.getQueriesData<CachedFeedData>({ queryKey: prefix }));
  FEED_QUERY_KEY_PREFIXES_THAT_LIST_POSTS.forEach((prefix) =>
    queryClient.setQueriesData<CachedFeedData>({ queryKey: prefix }, (data) => removePostFromCachedFeedData(data, postId)),
  );
  return () => snapshots.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}
