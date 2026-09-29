import { Share } from "react-native";

import { ProfileHeaderBar } from "@/components/profile/profileHeaderBar";
import { useToggleFollowMutation, useUserPostsQuery, useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import type { ProfileAction } from "@/components/profile/profileSummary";
import { ProfileView } from "@/components/profile/profileView";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function UserProfileScreen({ navigation, route }: MainScreenProps<"UserProfile">) {
  const { userId } = route.params;
  const profileQuery = useUserProfileQuery(userId);
  const postsQuery = useUserPostsQuery(userId);
  const toggleFollow = useToggleFollowMutation(userId);
  const profile = profileQuery.data;
  const isFollowing = profile?.isFollowing ?? false;

  const actions: ProfileAction[] = profile
    ? [
        { label: isFollowing ? "Following" : "Follow", onPress: () => toggleFollow.mutate(isFollowing) },
        { label: "Message", onPress: () => navigation.navigate("Chat", { userId, name: profile.name }) },
        ...(profile.isSeller && profile.storeId
          ? [{ label: "View Shop", onPress: () => navigation.navigate("Store", { storeId: profile.storeId! }) }]
          : []),
      ]
    : [];

  const shareProfileLink = () =>
    profile && Share.share({ message: `${profile.name} on Zudomart: https://zudomart.com/@${profile.username}` });

  return (
    <Screen background={colors.white}>
      <ProfileHeaderBar
        variant="other"
        onBack={() => navigation.goBack()}
        onSearch={() => navigation.navigate("Search", { scope: "all" })}
        onMore={shareProfileLink}
      />
      <ProfileView
        profile={profile}
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
    </Screen>
  );
}
