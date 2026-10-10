"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { showToast } from "@/components/ui/toast";
import { postsService } from "@/services/posts.service";
import type { Post } from "@/types";
import { updateMatchingRecordsInEveryQuery } from "@/utils/postEngagementCache.util";

export function usePostNotificationMute(post: Pick<Post, "id" | "viewerNotificationsMuted">) {
  const queryClient = useQueryClient();
  const [isMuted, setIsMuted] = useState(post.viewerNotificationsMuted === true);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!inFlight.current) setIsMuted(post.viewerNotificationsMuted === true);
  }, [post.viewerNotificationsMuted]);
  const setMutedEverywhere = (muted: boolean) => {
    setIsMuted(muted);
    updateMatchingRecordsInEveryQuery(queryClient, (record) => record.id === post.id && typeof record.liked === "boolean", (record) => ({ ...record, viewerNotificationsMuted: muted }));
  };
  const toggle = () =>
    requireAuthThen(() => {
      if (inFlight.current) return;
      const muted = !isMuted;
      inFlight.current = true;
      setMutedEverywhere(muted);
      (muted ? postsService.mutePostNotifications(post.id) : postsService.unmutePostNotifications(post.id))
        .then(() => showToast({ text: muted ? "You won't get notifications for this post" : "Notifications for this post are back on" }))
        .catch(() => {
          setMutedEverywhere(!muted);
          showToast({ text: "Couldn't update notifications. Try again.", tone: "error" });
        })
        .finally(() => {
          inFlight.current = false;
        });
    }, "Sign in to manage notifications.");
  return { isMuted, toggle };
}
