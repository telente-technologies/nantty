import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { minimumClipsToShowSuggestedRail, suggestedClipsPerRail } from "@/constants/feedModules.constant";
import { feedsService } from "@/services/feed/feeds.service";
import type { Clip } from "@/types";
import { takeChunkForOccurrence } from "@/utils/feedModuleLayout.util";
import { collectSuggestedRailClips } from "@/utils/suggestedVideoSequence.util";

export const suggestedClipsStreamQueryKey = ["suggestedClipsStream"] as const;
export const suggestedVideoStartQueryKey = (clipId: string) => ["suggestedVideos", "start", clipId] as const;

export function useSuggestedClipsStream({ enabled }: { readonly enabled: boolean }) {
  const stream = useInfiniteQuery({
    queryKey: suggestedClipsStreamQueryKey,
    queryFn: ({ pageParam }) => feedsService.fetchSuggestedClipsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 3_600_000,
  });
  const clips = useMemo(() => collectSuggestedRailClips<Clip>((stream.data?.pages ?? []).map((page) => page.data)), [stream.data]);

  const railClipsFor = useCallback((occurrence: number) => takeChunkForOccurrence(clips, occurrence, suggestedClipsPerRail), [clips]);
  const isRailAvailable = useCallback((occurrence: number) => railClipsFor(occurrence).length >= minimumClipsToShowSuggestedRail, [railClipsFor]);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = stream;
  const ensureClipsForRails = useCallback((railCount: number) => {
    if (clips.length >= railCount * suggestedClipsPerRail || !hasNextPage || isFetchingNextPage || isError) return;
    void fetchNextPage();
  }, [clips.length, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return { clips, railClipsFor, isRailAvailable, ensureClipsForRails };
}
