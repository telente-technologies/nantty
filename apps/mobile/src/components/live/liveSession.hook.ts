import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { liveService } from "@/services/live/live.service";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { mergeLiveCommentPages } from "./liveComments.util";

export function useLiveSessionWithActions(liveId: string, hasJoined: boolean) {
  const queryClient = useQueryClient();
  const [isFollowingHost, setIsFollowingHost] = useState<boolean | null>(null);

  const session = useQuery({ queryKey: ["live", liveId], queryFn: () => liveService.fetchLiveSessionById(liveId), refetchInterval: 10_000 });
  const latestComments = useQuery({
    queryKey: ["live-comments", liveId],
    queryFn: () => liveService.fetchLiveComments(liveId),
    enabled: hasJoined,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });
  const [historyAnchorState, setHistoryAnchorState] = useState<{ readonly liveId: string; readonly cursor: string } | null>(null);
  const historyAnchor = historyAnchorState?.liveId === liveId ? historyAnchorState.cursor : null;
  const commentHistory = useInfiniteQuery({
    queryKey: ["live-comment-history", liveId, historyAnchor],
    queryFn: ({ pageParam }) => liveService.fetchLiveComments(liveId, pageParam ?? undefined),
    initialPageParam: historyAnchor,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: hasJoined && historyAnchor !== null,
    refetchOnWindowFocus: false,
  });

  const loadOlderComments = () => {
    if (!hasJoined || !latestComments.data?.nextCursor || commentHistory.isFetchingNextPage) return;
    if (historyAnchor === null) setHistoryAnchorState({ liveId, cursor: latestComments.data.nextCursor });
    else if (commentHistory.hasNextPage) void commentHistory.fetchNextPage();
  };

  const historyPages = commentHistory.data?.pages ?? [];
  const lastHistoryPage = historyPages[historyPages.length - 1];
  const comments = {
    data: {
      data: mergeLiveCommentPages(
        latestComments.data?.data ?? [],
        historyPages.map((page) => page.data),
      ),
      nextCursor: lastHistoryPage ? lastHistoryPage.nextCursor : latestComments.data?.nextCursor ?? null,
    },
    isLoading: latestComments.isLoading,
    isFetching: latestComments.isFetching,
    isFetchingOlder: commentHistory.isFetchingNextPage || (historyAnchor !== null && commentHistory.isLoading),
    olderError: commentHistory.isFetchNextPageError || (historyAnchor !== null && commentHistory.isError),
    canLoadOlder: Boolean(latestComments.data?.nextCursor) && (historyAnchor === null || commentHistory.hasNextPage),
    loadOlder: loadOlderComments,
    retryOlder: () => {
      if (historyAnchor === null) loadOlderComments();
      else if (commentHistory.data?.pages.length) void commentHistory.fetchNextPage();
      else void commentHistory.refetch();
    },
  };

  const sendComment = useMutation({
    mutationFn: (text: string) => liveService.sendCommentToLive(liveId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-comments", liveId], exact: true }),
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
