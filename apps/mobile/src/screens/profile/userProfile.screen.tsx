import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { creatorQueryKeys } from "@/components/creator/creatorQueries.hook";
import { ProfileHeaderBar } from "@/components/profile/profileHeaderBar";
import { ProfileMoreSheet } from "@/components/profile/profileMoreSheet";
import { useToggleFollowMutation, useUserPostsQuery, useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import type { ProfileAction } from "@/components/profile/profileSummary";
import { ProfileView } from "@/components/profile/profileView";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { useAuthStore } from "@/store/auth.store";

export function UserProfileScreen({ navigation, route }: MainScreenProps<"UserProfile">) {
  const { userId } = route.params;
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const viewingOwnProfile = userId === signedInUserId;
  const profileQuery = useUserProfileQuery(userId);
  const postsQuery = useUserPostsQuery(userId);
  const toggleFollow = useToggleFollowMutation(userId);
  const subscriptionPlans = useQuery({
    queryKey: creatorQueryKeys.plansOfCreator(userId),
    queryFn: () => creatorProgramService.listSubscriptionPlansOfCreator(userId),
    enabled: !viewingOwnProfile,
  });
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const profile = profileQuery.data;
  const isFollowing = profile?.isFollowing ?? false;

  useEffect(() => {
    if (viewingOwnProfile) navigation.replace("Tabs", { screen: "Me" });
  }, [viewingOwnProfile, navigation]);

  const actions: ProfileAction[] = profile
    ? [
        { label: isFollowing ? "Following" : "Follow", onPress: () => toggleFollow.mutate(isFollowing), highlighted: !isFollowing },
        { label: "Message", onPress: () => navigation.navigate("Chat", { userId, name: profile.name }) },
        ...(profile.isSeller && profile.storeId ? [{ label: "View Shop", onPress: () => navigation.navigate("Store", { storeId: profile.storeId! }) }] : []),
        ...((subscriptionPlans.data?.length ?? 0) > 0 ? [{ label: "Subscribe", onPress: () => navigation.navigate("CreatorSubscribe", { creatorId: userId }) }] : []),
      ]
    : [];

  return (
    <Screen background={colors.white}>
      <ProfileHeaderBar
        variant="other"
        onBack={() => navigation.goBack()}
        onSearch={() => navigation.navigate("Search", { scope: "all" })}
        onMore={() => setMoreSheetVisible(true)}
      />
      <ProfileView
        profile={viewingOwnProfile ? undefined : profile}
        posts={postsQuery.data?.data ?? []}
        variant="other"
        tabs={profile?.isSeller ? ["posts", "reposts", "clips", "store"] : ["posts", "reposts", "clips"]}
        actions={actions}
        loading={postsQuery.isLoading}
        refreshing={profileQuery.isRefetching || postsQuery.isRefetching}
        onRefresh={() => {
          profileQuery.refetch();
          postsQuery.refetch();
        }}
        onPressFollowers={() => navigation.navigate("Connections", { userId, tab: "followers" })}
        onPressFollowing={() => navigation.navigate("Connections", { userId, tab: "following" })}
        onPressPost={(post) => navigation.navigate("PostDetail", { postId: post.id })}
        onOpenStoreTab={profile?.storeId ? () => navigation.navigate("Store", { storeId: profile.storeId! }) : undefined}
      />
      {profile ? (
        <ProfileMoreSheet profile={profile} visible={moreSheetVisible} onClose={() => setMoreSheetVisible(false)} onBlocked={() => navigation.goBack()} />
      ) : null}
    </Screen>
  );
}
