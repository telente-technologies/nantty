import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { liveService } from "@/services/live.service";

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

  const followHost = () => {
    if (!session.data) return;
    setIsFollowingHost(true);
    liveService.followLiveHost(session.data.host.id).catch(() => setIsFollowingHost(false));
  };

  return {
    session,
    comments,
    sendComment,
    followHost,
    isFollowingHost: isFollowingHost ?? session.data?.isFollowingHost ?? false,
    sendReaction: (emoji: string) => liveService.sendReactionToLive(liveId, emoji).catch(() => undefined),
  };
}
