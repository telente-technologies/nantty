import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";

import { OwnProfileCards } from "@/components/profile/ownProfileCards";
import { OwnProfileMenu } from "@/components/profile/ownProfileMenu";
import { ProfileHeaderBar } from "@/components/profile/profileHeaderBar";
import { useMyProfileQuery, useUserPostsQuery } from "@/components/profile/profileQueries.hook";
import { ProfileView } from "@/components/profile/profileView";
import { usePinPostMutation } from "@/components/feed/usePinPost.hook";
import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { ArrowUpRight24Icon, ChatCircle24Icon, PushPin24Icon, Trash24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Screen } from "@/components/ui/screen";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Post } from "@/types";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useProfileSwitcherSheetStore } from "@/store/profileSwitcherSheet.store";
import { webAppLinks } from "@/config/webAppLinks.config";
import { spacing } from "@/constants/spacing.constant";

export function MeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const profileQuery = useMyProfileQuery();
  const profile = profileQuery.data;
  const postsQuery = useUserPostsQuery(profile?.id);
  const [postWithOpenMenu, setPostWithOpenMenu] = useState<Post | null>(null);
  const pinMutation = usePinPostMutation();
  const { confirmAndDelete } = useDeleteOwnPost();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const actingProfileId = useActingProfileStore((s) => s.actingProfile?.id ?? null);
  const openProfileSwitcherSheet = useProfileSwitcherSheetStore((s) => s.openProfileSwitcherSheet);

  const openPostAction = (action: () => void) => {
    setPostWithOpenMenu(null);
    action();
  };

  const shareMyProfileLink = () => {
    if (!profile) return;
    Share.share({ message: `Follow ${profile.name} on Zudomart: ${webAppLinks.profile(profile.username)}` });
  };

  const refreshProfileAndPosts = () => {
    profileQuery.refetch();
    postsQuery.refetch();
  };

  return (
    <Screen>
      <ProfileHeaderBar
        variant="own"
        switcherLabel={profile ? profile.username : undefined}
        onPressSwitcher={profile ? openProfileSwitcherSheet : undefined}
        onSearch={() => navigation.navigate("Search", profile ? { scope: `profile:${profile.id}`, scopeLabel: `@${profile.username}` } : { scope: "global" })}
        onMore={() => setIsProfileMenuOpen(true)}
      />
      {profileQuery.isError && !profile ? (
        <ErrorState message="Couldn't load your profile." onRetry={() => profileQuery.refetch()} retrying={profileQuery.isRefetching} />
      ) : (
      <ProfileView
        key={actingProfileId ?? profile?.id ?? "me"}
        profile={profile}
        posts={postsQuery.data?.data ?? []}
        variant="own"
        tabs={profile?.isSeller ? ["posts", "reposts", "clips", "store"] : ["posts", "reposts", "clips"]}
        actions={[
          { label: "Edit profile", onPress: () => navigation.navigate("EditProfile") },
          { label: "Share profile", onPress: shareMyProfileLink },
        ]}
        headerAccessory={profile ? <OwnProfileCards profile={profile} /> : null}
        loading={postsQuery.isLoading}
        refreshing={profileQuery.isRefetching || postsQuery.isRefetching}
        onRefresh={refreshProfileAndPosts}
        onPressFollowers={() => profile && navigation.navigate("Connections", { userId: profile.id, tab: "followers" })}
        onPressFollowing={() => profile && navigation.navigate("Connections", { userId: profile.id, tab: "following" })}
        onPressPost={(post) => navigation.navigate("PostDetail", { postId: post.id })}
        onOpenStoreTab={profile?.storeId ? () => navigation.navigate("Store", { storeId: profile.storeId! }) : undefined}
        onPressPostMore={setPostWithOpenMenu}
      />
      )}
      {profile ? <OwnProfileMenu visible={isProfileMenuOpen} profile={profile} onClose={() => setIsProfileMenuOpen(false)} /> : null}
      <BottomSheet visible={postWithOpenMenu !== null} onClose={() => setPostWithOpenMenu(null)} floating>
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" style={styles.option} onPress={() => postWithOpenMenu && openPostAction(() => navigation.navigate("PromotePost", { postId: postWithOpenMenu.id }))}>
            <ArrowUpRight24Icon size={20} color={colors.primary} />
            <Text size={15} lineHeight={18} color={colors.primary}>Promote this post</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.option} onPress={() => postWithOpenMenu && openPostAction(() => navigation.navigate("PostDetail", { postId: postWithOpenMenu.id }))}>
            <ChatCircle24Icon size={20} color={colors.textMuted} />
            <Text size={15} lineHeight={18}>View post</Text>
          </Pressable>
          {postWithOpenMenu ? (
            <Pressable accessibilityRole="button" style={styles.option} onPress={() => openPostAction(() => pinMutation.mutate(postWithOpenMenu))} disabled={pinMutation.isPending}>
              <PushPin24Icon size={20} color={colors.text} />
              <Text size={15} lineHeight={18}>{postWithOpenMenu.isPinned === true ? "Unpin from profile" : "Pin to profile"}</Text>
            </Pressable>
          ) : null}
          {postWithOpenMenu ? (
            <Pressable accessibilityRole="button" style={styles.option} onPress={() => openPostAction(() => confirmAndDelete({ id: postWithOpenMenu.id, kind: postWithOpenMenu.kind ?? "post" }))}>
              <Trash24Icon size={20} />
              <Text size={15} lineHeight={18} color={colors.error}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  menu: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  option: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
}));
