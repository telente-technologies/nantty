import { useState, type ReactNode } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { ProfileCelebration } from "@/components/celebrations/profileCelebration";
import { PostCard } from "@/components/feed/postCard";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { Post, User } from "@/types";

import { lockedProfileCopyByLock, type LockedProfileCopy } from "./followState.util";
import { LockedProfileNotice } from "./lockedProfileNotice";
import { ProfileSoundsList } from "./profileSoundsList";
import { ProfileSummary, type ProfileAction } from "./profileSummary";
import { ProfileTabs, type ProfileTabKey } from "./profileTabs";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface ProfileViewProps {
  readonly profile: User | undefined;
  readonly posts: readonly Post[];
  readonly variant: "own" | "other";
  readonly tabs: readonly ProfileTabKey[];
  readonly actions: readonly ProfileAction[];
  readonly identityAction?: ProfileAction;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onPressFollowers: () => void;
  readonly onPressFollowing: () => void;
  readonly onPressPost: (post: Post) => void;
  readonly onOpenStoreTab?: () => void;
  readonly headerAccessory?: ReactNode;
  readonly isLocked?: boolean;
  readonly lockedCopy?: LockedProfileCopy;
  readonly onPressPostMore?: (post: Post) => void;
}

const EMPTY_TAB_MESSAGES: Record<ProfileTabKey, string> = {
  posts: "No posts yet",
  reposts: "No reposts yet",
  clips: "No clips yet",
  sounds: "",
  store: "",
};

export function ProfileView(props: ProfileViewProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("posts");
  const visiblePosts = activeTab === "posts" && !props.isLocked ? props.posts : [];

  const changeTabOrOpenStore = (tab: ProfileTabKey) => {
    if (tab === "store" && props.onOpenStoreTab) {
      props.onOpenStoreTab();
      return;
    }
    setActiveTab(tab);
  };

  if (!props.profile) {
    return (
      <View style={styles.loading}>
        <BrandLoader size="lg" />
      </View>
    );
  }

  return (
    <FlatList
      data={visiblePosts}
      keyExtractor={(post) => post.id}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ProfileSummary
            profile={props.profile}
            variant={props.variant}
            actions={props.actions}
            identityAction={props.identityAction}
            onPressFollowers={props.onPressFollowers}
            onPressFollowing={props.onPressFollowing}
          />
          <ProfileCelebration profile={props.profile} variant={props.variant} />
          {props.headerAccessory}
          {props.isLocked ? null : <ProfileTabs tabs={props.tabs} activeTab={activeTab} onChangeTab={changeTabOrOpenStore} />}
        </View>
      }
      renderItem={({ item, index }) => (
        <PostCard post={item} surface="profile" position={index} showPinnedBadge onPress={() => props.onPressPost(item)} onPressMore={props.onPressPostMore ? () => props.onPressPostMore!(item) : undefined} />
      )}
      ListEmptyComponent={
        props.isLocked ? (
          <LockedProfileNotice copy={props.lockedCopy ?? lockedProfileCopyByLock.private} />
        ) : activeTab === "sounds" ? (
          <ProfileSoundsList profile={props.profile} />
        ) : props.loading ? (
          <BrandLoader size="md" style={styles.empty} />
        ) : (
          <Text size={typeScale.md} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
            {EMPTY_TAB_MESSAGES[activeTab]}
          </Text>
        )
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: spacing[6] },
  content: { paddingBottom: spacing[8] },
  empty: { marginTop: 48 },
});
