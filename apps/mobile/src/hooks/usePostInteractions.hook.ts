import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Share } from "react-native";

import { postsService } from "@/services/posts.service";
import { requireAuthThen } from "@/utils/requireAuth.util";
import type { Page, Post } from "@/types";
import { webAppLinks } from "@/config/webAppLinks.config";

export const feedQueryKeyPrefix = ["feed"] as const;

export function usePostInteractions() {
  const queryClient = useQueryClient();

  const updatePostInEveryCachedFeed = (postId: string, change: (post: Post) => Post) => {
    queryClient.setQueriesData<InfiniteData<Page<Post>>>({ queryKey: feedQueryKeyPrefix }, (cached) =>
      cached
        ? { ...cached, pages: cached.pages.map((page) => ({ ...page, data: page.data.map((p) => (p.id === postId ? change(p) : p)) })) }
        : cached,
    );
  };

  const applyPostLikeToggle = async (post: Post) => {
    const likeNow = !post.liked;
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, liked: likeNow, likes: p.likes + (likeNow ? 1 : -1) }));
    try {
      await (likeNow ? postsService.likePost(post.id) : postsService.unlikePost(post.id));
    } catch {
      updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, liked: !likeNow, likes: p.likes + (likeNow ? -1 : 1) }));
    }
  };

  const applyFollowPostAuthor = async (post: Post) => {
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, isFollowingAuthor: true }));
    try {
      await postsService.followPostAuthor(post.author.id);
    } catch {
      updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, isFollowingAuthor: false }));
    }
  };

  const prependToEveryCachedFeed = (created: Post) => {
    queryClient.setQueriesData<InfiniteData<Page<Post>>>({ queryKey: feedQueryKeyPrefix }, (cached) =>
      cached
        ? {
            ...cached,
            pages: cached.pages.map((page, index) =>
              index === 0 && !page.data.some((item) => item.id === created.id) ? { ...page, data: [created, ...page.data] } : page,
            ),
          }
        : cached,
    );
  };

  const resharePost = async (post: Post, text?: string) => {
    const created = await postsService.repostPost(post.id, text);
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, reposts: p.reposts + 1 }));
    prependToEveryCachedFeed(created);
  };

  const sharePost = async (post: Post) => {
    const result = await Share.share({ message: `${post.author.name} on Zudomart: ${webAppLinks.post(post.id)}` }).catch(() => null);
    if (result?.action === Share.sharedAction) postsService.recordPostShare(post.id).catch(() => undefined);
  };

  const togglePostLike = (post: Post) => requireAuthThen(() => applyPostLikeToggle(post), undefined, "like posts");
  const followPostAuthor = (post: Post) => requireAuthThen(() => applyFollowPostAuthor(post), undefined, "follow creators");

  return { togglePostLike, followPostAuthor, resharePost, sharePost };
}
