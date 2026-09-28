import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Share } from "react-native";

import { postsService } from "@/services/posts.service";
import type { Page, Post } from "@/types";

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

  const togglePostLike = async (post: Post) => {
    const likeNow = !post.liked;
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, liked: likeNow, likes: p.likes + (likeNow ? 1 : -1) }));
    try {
      await (likeNow ? postsService.likePost(post.id) : postsService.unlikePost(post.id));
    } catch {
      updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, liked: !likeNow, likes: p.likes + (likeNow ? -1 : 1) }));
    }
  };

  const followPostAuthor = async (post: Post) => {
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, isFollowingAuthor: true }));
    try {
      await postsService.followPostAuthor(post.author.id);
    } catch {
      updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, isFollowingAuthor: false }));
    }
  };

  const repostPost = async (post: Post) => {
    updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, reposts: p.reposts + 1 }));
    await postsService.repostPost(post.id).catch(() => updatePostInEveryCachedFeed(post.id, (p) => ({ ...p, reposts: p.reposts - 1 })));
  };

  const sharePost = async (post: Post) => {
    const result = await Share.share({ message: `${post.author.name} on Zudomart: https://zudomart.com/p/${post.id}` }).catch(() => null);
    if (result?.action === Share.sharedAction) postsService.recordPostShare(post.id).catch(() => undefined);
  };

  return { togglePostLike, followPostAuthor, repostPost, sharePost };
}
