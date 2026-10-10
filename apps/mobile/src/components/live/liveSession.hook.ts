import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { liveService } from "@/services/live/live.service";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function useLiveSessionWithActions(liveId: string, hasJoined: boolean) {
  const queryClient = useQueryClient();
  const [isFollowingHost, setIsFollowingHost] = useState<boolean | null>(null);

  const session = useQuery({ queryKey: ["live", liveId], queryFn: () => liveService.fetchLiveSessionById(liveId), refetchInterval: 10_000 });
  const comments = useQuery({
    queryKey: ["live-comments", liveId],
    queryFn: () => liveService.fetchLiveComments(liveId),
    enabled: hasJoined,
    refetchInterval: 3_000,
  });

  const sendComment = useMutation({
    mutationFn: (text: string) => liveService.sendCommentToLive(liveId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-comments", liveId] }),
  });

  const followHost = () =>
    requireAuthThen(() => {
      if (!session.data) return;
      setIsFollowingHost(true);
      liveService.followLiveHost(session.data.host.id).catch(() => setIsFollowingHost(false));
    }, undefined, "follow creators");

  return {
    session,
    comments,
    sendComment,
    followHost,
    isFollowingHost: isFollowingHost ?? session.data?.isFollowingHost ?? false,
    sendReaction: (emoji: string) => requireAuthThen(() => liveService.sendReactionToLive(liveId, emoji).then(() => undefined, () => undefined), undefined, "react to lives"),
  };
}
