import type { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/errors/api.error";
import { postsService } from "@/services/content/posts.service";
import { showToast } from "@/store/toast.store";

import { readCachedLikedState, setLikedStateEverywhere } from "./postEngagementCache.util";

interface LikeSyncState {
  desired: boolean;
  confirmed: boolean;
  isSending: boolean;
}

const likeSyncByPostId = new Map<string, LikeSyncState>();

export interface LikeablePost {
  readonly id: string;
  readonly liked: boolean;
}

const describeLikeFailure = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 410) ? "This post isn't available anymore." : "Couldn't update your like. Try again.";

async function sendUntilServerMatchesDesired(queryClient: QueryClient, postId: string, sync: LikeSyncState) {
  sync.isSending = true;
  try {
    while (sync.desired !== sync.confirmed) {
      const target = sync.desired;
      try {
        await (target ? postsService.likePost(postId) : postsService.unlikePost(postId));
        sync.confirmed = target;
      } catch (error) {
        sync.desired = sync.confirmed;
        setLikedStateEverywhere(queryClient, postId, sync.confirmed);
        showToast(describeLikeFailure(error), { tone: "error" });
        return;
      }
    }
  } finally {
    sync.isSending = false;
    if (likeSyncByPostId.get(postId) === sync) likeSyncByPostId.delete(postId);
  }
}

export function currentLikedState(queryClient: QueryClient, post: LikeablePost) {
  return likeSyncByPostId.get(post.id)?.desired ?? readCachedLikedState(queryClient, post.id) ?? post.liked;
}

export function setPostLiked(queryClient: QueryClient, post: LikeablePost, liked: boolean): Promise<void> {
  const existing = likeSyncByPostId.get(post.id);
  const sync = existing ?? { desired: liked, confirmed: currentLikedState(queryClient, post), isSending: false };
  sync.desired = liked;
  likeSyncByPostId.set(post.id, sync);
  setLikedStateEverywhere(queryClient, post.id, liked);
  if (sync.isSending || sync.desired === sync.confirmed) {
    if (!sync.isSending) likeSyncByPostId.delete(post.id);
    return Promise.resolve();
  }
  return sendUntilServerMatchesDesired(queryClient, post.id, sync);
}

export const togglePostLiked = (queryClient: QueryClient, post: LikeablePost) => setPostLiked(queryClient, post, !currentLikedState(queryClient, post));

export const resetPostLikeSyncForTests = () => likeSyncByPostId.clear();
