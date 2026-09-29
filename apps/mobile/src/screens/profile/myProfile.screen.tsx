import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Share } from "react-native";

import { ProfileHeaderBar } from "@/components/profile/profileHeaderBar";
import { useMyProfileQuery, useUserPostsQuery } from "@/components/profile/profileQueries.hook";
import { ProfileView } from "@/components/profile/profileView";
import { Screen } from "@/components/ui/screen";
import type { MainStackParamList } from "@/navigation/navigation.types";

export function MeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const profileQuery = useMyProfileQuery();
  const profile = profileQuery.data;
  const postsQuery = useUserPostsQuery(profile?.id);

  const shareMyProfileLink = () => {
    if (!profile) return;
    Share.share({ message: `Follow ${profile.name} on Zudomart: https://zudomart.com/@${profile.username}` });
  };

  const refreshProfileAndPosts = () => {
    profileQuery.refetch();
    postsQuery.refetch();
  };

  return (
    <Screen>
      <ProfileHeaderBar
        variant="own"
        onSearch={() => navigation.navigate("Search", { scope: "all" })}
        onMore={() => navigation.navigate("Settings")}
      />
      <ProfileView
        profile={profile}
        posts={postsQuery.data?.data ?? []}
        variant="own"
        tabs={["posts", "reposts", "clips"]}
        actions={[
          { label: "Share", onPress: shareMyProfileLink },
          { label: "Edit profile", onPress: () => navigation.navigate("EditProfile") },
        ]}
        loading={postsQuery.isLoading}
        refreshing={profileQuery.isRefetching || postsQuery.isRefetching}
        onRefresh={refreshProfileAndPosts}
        onPressFollowers={() => profile && navigation.navigate("Connections", { userId: profile.id, tab: "followers" })}
        onPressFollowing={() => profile && navigation.navigate("Connections", { userId: profile.id, tab: "following" })}
        onPressPost={(post) => navigation.navigate("PostDetail", { postId: post.id })}
      />
    </Screen>
  );
}
