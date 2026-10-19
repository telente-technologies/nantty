import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { MainStackParamList } from "@/navigation/navigation.types";
import { storiesService } from "@/services/clips/stories.service";
import { profileAvatarPresenceService } from "@/services/social/profileAvatarPresence.service";
import { showToast } from "@/store/toast.store";
import { openLiveWhenStillOn, openStoryWhenStillActive, resolveProfileAvatarPresence } from "@/utils/profileAvatarPresence.util";

export const profileAvatarPresenceQueryKeys = {
  storyStatus: (userId: string) => ["users", userId, "story-status"] as const,
  liveStatus: (userId: string) => ["users", userId, "live"] as const,
};

export function useProfileAvatarPresence(userId: string, isProfileHiddenFromViewer: boolean) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const enabled = !isProfileHiddenFromViewer;
  const storyStatus = useQuery({ queryKey: profileAvatarPresenceQueryKeys.storyStatus(userId), queryFn: () => profileAvatarPresenceService.fetchStoryRingStatus(userId), enabled, retry: false });
  const liveStatus = useQuery({ queryKey: profileAvatarPresenceQueryKeys.liveStatus(userId), queryFn: () => profileAvatarPresenceService.fetchHostLiveStatus(userId), enabled, retry: false });
  const presence = resolveProfileAvatarPresence({ storyStatus: storyStatus.data, liveStatus: liveStatus.data, isProfileHiddenFromViewer });

  const reportUnavailable = useCallback((message: string) => {
    showToast(message);
    void queryClient.invalidateQueries({ queryKey: profileAvatarPresenceQueryKeys.storyStatus(userId) });
    void queryClient.invalidateQueries({ queryKey: profileAvatarPresenceQueryKeys.liveStatus(userId) });
  }, [queryClient, userId]);

  const openStory = useCallback(
    () => openStoryWhenStillActive(userId, async (ownerId) => {
      const stories = await storiesService.fetchStoriesForUser(ownerId);
      queryClient.setQueryData(["stories", ownerId], stories);
      return stories;
    }, { open: (ownerId) => navigation.navigate("Story", { userId: ownerId }), reportUnavailable }),
    [navigation, queryClient, reportUnavailable, userId],
  );

  const openLive = useCallback(
    () => openLiveWhenStillOn(userId, (hostId) => queryClient.fetchQuery({ queryKey: profileAvatarPresenceQueryKeys.liveStatus(hostId), queryFn: () => profileAvatarPresenceService.fetchHostLiveStatus(hostId), staleTime: 0 }), {
      open: (liveId) => navigation.navigate("Live", { liveId }),
      reportUnavailable,
    }),
    [navigation, queryClient, reportUnavailable, userId],
  );

  return { presence, openStory, openLive };
}
