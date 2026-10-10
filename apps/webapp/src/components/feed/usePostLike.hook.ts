"use client";

import { useQueryClient } from "@tanstack/react-query";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { showToast } from "@/components/ui/toast";
import { WebappRequestError } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import { currentLikedState, setPostLiked, type LikeSender } from "@/utils/postEngagementCache.util";

const describeLikeFailure = (error: unknown) =>
  error instanceof WebappRequestError && (error.status === 404 || error.status === 410) ? "This post isn't available anymore." : "Couldn't update your like. Try again.";

const likeSender: LikeSender = {
  send: (postId, liked) => (liked ? postsService.likePost(postId) : postsService.unlikePost(postId)),
  onFailed: (error) => showToast({ text: describeLikeFailure(error), tone: "error" }),
};

type LikeablePost = { readonly id: string; readonly liked: boolean };

export function usePostLikeActions() {
  const queryClient = useQueryClient();
  const setLiked = (post: LikeablePost, liked: boolean, signInMessage: string) =>
    requireAuthThen(() => void setPostLiked(queryClient, post.id, liked, post.liked, likeSender), signInMessage);
  const toggleLike = (post: LikeablePost, signInMessage = "Sign in to like posts.") => setLiked(post, !currentLikedState(queryClient, post.id, post.liked), signInMessage);
  const likeIfNotLiked = (post: LikeablePost, signInMessage = "Sign in to like posts.") => setLiked(post, true, signInMessage);
  return { toggleLike, likeIfNotLiked };
}

export function usePostLike(post: LikeablePost, signInMessage = "Sign in to like posts.") {
  const actions = usePostLikeActions();
  return { toggleLike: () => actions.toggleLike(post, signInMessage), likeIfNotLiked: () => actions.likeIfNotLiked(post, signInMessage) };
}
