"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { usePostLikeActions } from "@/components/feed/usePostLike.hook";
import { showToast } from "@/components/ui/toast";
import { discoveryService } from "@/services/discovery.service";
import type { Clip } from "@/types";
import { setFollowingAuthorEverywhere } from "@/utils/postEngagementCache.util";
import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";

import type { ClipEngagement } from "./clipPlayerCard";

export function useClipInteractions() {
  const queryClient = useQueryClient();
  const clipLikeActions = usePostLikeActions();
  const [shareCountByClipId, setShareCountByClipId] = useState<Record<string, number>>({});

  const engagementFor = (clip: Clip): ClipEngagement => ({ liked: clip.liked, likes: clip.likes, isFollowing: clip.isFollowingAuthor });
  const toggleLikeOnClip = (clip: Clip) => clipLikeActions.toggleLike(clip, "Sign in to like clips.");
  const likeClipWithDoubleTap = (clip: Clip) => {
    if (!clip.liked) clipLikeActions.likeIfNotLiked(clip, "Sign in to like clips.");
  };
  const toggleFollowOnClipAuthor = (clip: Clip) =>
    requireAuthThen(() => {
      if (clip.isFollowingAuthor) return;
      setFollowingAuthorEverywhere(queryClient, clip.author.id, true);
      void discoveryService.followClipAuthor(clip.author.id).catch(() => setFollowingAuthorEverywhere(queryClient, clip.author.id, false));
    }, "Sign in to follow creators.");

  const shareClipLink = (clip: Clip) => {
    const url = buildAbsoluteSiteUrl(`/clips?start=${clip.id}`);
    const copyAndRecord = async () => {
      try {
        await navigator.clipboard.writeText(url);
        showToast({ text: "Link copied" });
      } catch {
        showToast({ text: "Couldn't copy the link", tone: "error" });
      }
      setShareCountByClipId((all) => ({ ...all, [clip.id]: (all[clip.id] ?? clip.shares) + 1 }));
      void discoveryService.recordClipShare(clip.id).catch(() => setShareCountByClipId((all) => ({ ...all, [clip.id]: all[clip.id] ?? clip.shares })));
    };
    void copyAndRecord();
  };

  const shareCountFor = (clip: Clip) => shareCountByClipId[clip.id] ?? clip.shares;

  return { engagementFor, toggleLikeOnClip, likeClipWithDoubleTap, toggleFollowOnClipAuthor, shareClipLink, shareCountFor };
}
