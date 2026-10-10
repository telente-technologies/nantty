import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { updateMatchingRecordsInEveryQuery } from "@/cache/postEngagementCache.util";
import { postsService } from "@/services/content/posts.service";
import { showToast } from "@/store/toast.store";
import type { Post } from "@/types";

export { postNotificationMuteLabel } from "@/utils/postNotificationMute.util";

export function usePostNotificationMute() {
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set<string>());
  const setMutedEverywhere = (postId: string, muted: boolean) =>
    updateMatchingRecordsInEveryQuery(queryClient, (record) => record.id === postId && typeof record.liked === "boolean", (post) => ({ ...post, viewerNotificationsMuted: muted }));

  const togglePostNotifications = (post: Pick<Post, "id" | "viewerNotificationsMuted">) => {
    if (inFlight.current.has(post.id)) return;
    const muted = post.viewerNotificationsMuted !== true;
    inFlight.current.add(post.id);
    setMutedEverywhere(post.id, muted);
    (muted ? postsService.mutePostNotifications(post.id) : postsService.unmutePostNotifications(post.id))
      .then(() => showToast(muted ? "You won't get notifications for this post" : "Notifications for this post are back on", { tone: "success" }))
      .catch(() => {
        setMutedEverywhere(post.id, !muted);
        showToast("Couldn't update notifications. Try again.", { tone: "error" });
      })
      .finally(() => inFlight.current.delete(post.id));
  };
  return { togglePostNotifications };
}
