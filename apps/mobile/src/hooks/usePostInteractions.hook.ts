import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Share } from "react-native";

import { isPostWithRepostCount, setFollowingAuthorEverywhere, updateMatchingRecordsInEveryQuery } from "@/cache/postEngagementCache.util";
import { togglePostLiked, type LikeablePost } from "@/cache/postLikeSync.util";
import { postsService } from "@/services/content/posts.service";
import { requireAuthThen } from "@/utils/requireAuth.util";
import type { Page, Post } from "@/types";
import { webAppLinks } from "@/config/webAppLinks.config";

export const feedQueryKeyPrefix = ["feed"] as const;

type SharablePost = Pick<Post, "id"> & { readonly author: Pick<Post["author"], "id" | "name"> };

export function usePostInteractions() {
  const queryClient = useQueryClient();

  const applyFollowPostAuthor = async (post: SharablePost) => {
    setFollowingAuthorEverywhere(queryClient, post.author.id, true);
    try {
      await postsService.followPostAuthor(post.author.id);
    } catch {
      setFollowingAuthorEverywhere(queryClient, post.author.id, false);
    }
  };

  const prependToEveryCachedFeed = (created: Post) => {
    queryClient.setQueriesData<InfiniteData<Page<Post>>>({ queryKey: feedQueryKeyPrefix }, (cached) =>
      cached?.pages
        ? {
            ...cached,
            pages: cached.pages.map((page, index) =>
              index === 0 && !page.data.some((item) => item.id === created.id) ? { ...page, data: [created, ...page.data] } : page,
            ),
          }
        : cached,
    );
  };

  const resharePost = async (post: Pick<Post, "id">, text?: string) => {
    const created = await postsService.repostPost(post.id, text);
    updateMatchingRecordsInEveryQuery(queryClient, isPostWithRepostCount(post.id), (p) =>
      text ? { ...p, reposts: (p.reposts as number) + 1 } : p.reposted === true ? p : { ...p, reposted: true, reposts: (p.reposts as number) + 1 },
    );
    prependToEveryCachedFeed(created);
  };

  const undoRepost = async (post: Pick<Post, "id">) => {
    await postsService.undoRepost(post.id);
    updateMatchingRecordsInEveryQuery(queryClient, isPostWithRepostCount(post.id), (p) =>
      p.reposted === true ? { ...p, reposted: false, reposts: Math.max(0, (p.reposts as number) - 1) } : p,
    );
    queryClient.invalidateQueries({ queryKey: feedQueryKeyPrefix });
  };

  const sharePost = async (post: SharablePost) => {
    const result = await Share.share({ message: `${post.author.name} on Nantty: ${webAppLinks.post(post.id)}` }).catch(() => null);
    if (result?.action === Share.sharedAction) postsService.recordPostShare(post.id).catch(() => undefined);
  };

  const togglePostLike = (post: LikeablePost) => requireAuthThen(() => togglePostLiked(queryClient, post), undefined, "like posts");
  const followPostAuthor = (post: SharablePost) => requireAuthThen(() => applyFollowPostAuthor(post), undefined, "follow creators");

  return { togglePostLike, followPostAuthor, resharePost, undoRepost, sharePost };
}
