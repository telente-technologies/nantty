import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { followsService } from "@/services/social/follows.service";
import { usersService, type ProfileDetailsUpdate } from "@/services/account/users.service";
import { useAuthStore } from "@/store/auth.store";
import type { ConnectionTab } from "@/types/account.type";

export const profileQueryKeys = {
  myProfile: ["users", "me"] as const,
  userProfile: (userId: string) => ["users", userId] as const,
  userPosts: (userId: string) => ["users", userId, "posts"] as const,
  connections: (userId: string, tab: ConnectionTab) => ["users", userId, "connections", tab] as const,
  settings: ["users", "me", "settings"] as const,
  addresses: ["users", "me", "addresses"] as const,
};

export function useMyProfileQuery() {
  const updateSignedInUser = useAuthStore((s) => s.updateSignedInUser);
  return useQuery({
    queryKey: profileQueryKeys.myProfile,
    queryFn: async () => {
      const profile = await usersService.fetchMyProfile();
      updateSignedInUser(profile);
      return profile;
    },
  });
}

export function useUserProfileQuery(userId: string) {
  return useQuery({ queryKey: profileQueryKeys.userProfile(userId), queryFn: () => usersService.fetchUserProfileById(userId) });
}

export function useUserPostsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKeys.userPosts(userId ?? "none"),
    queryFn: () => usersService.fetchPostsByUserId(userId!),
    enabled: !!userId,
  });
}

export function useSaveProfileDetailsMutation() {
  const queryClient = useQueryClient();
  const updateSignedInUser = useAuthStore((s) => s.updateSignedInUser);
  return useMutation({
    mutationFn: (update: ProfileDetailsUpdate) => usersService.updateMyProfileDetails(update),
    onSuccess: (profile) => {
      updateSignedInUser(profile);
      queryClient.setQueryData(profileQueryKeys.myProfile, profile);
    },
  });
}

export function useToggleFollowMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      await (currentlyFollowing ? followsService.unfollowUser(userId) : followsService.followUser(userId));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
