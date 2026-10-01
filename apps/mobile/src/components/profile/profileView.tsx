import { useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Post, User } from "@/types";

import { ProfileSoundsList } from "./profileSoundsList";
import { ProfileSummary, type ProfileAction } from "./profileSummary";
import { ProfileTabs, type ProfileTabKey } from "./profileTabs";

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
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("posts");
  const visiblePosts = activeTab === "posts" ? props.posts : [];

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
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={visiblePosts}
      keyExtractor={(post) => post.id}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.primary} />}
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
          {props.headerAccessory}
          <ProfileTabs tabs={props.tabs} activeTab={activeTab} onChangeTab={changeTabOrOpenStore} />
        </View>
      }
      renderItem={({ item }) => (
        <PostCard post={item} onPress={() => props.onPressPost(item)} onPressMore={props.onPressPostMore ? () => props.onPressPostMore!(item) : undefined} />
      )}
      ListEmptyComponent={
        activeTab === "sounds" ? (
          <ProfileSoundsList profile={props.profile} />
        ) : props.loading ? (
          <ActivityIndicator style={styles.empty} color={colors.primary} />
        ) : (
          <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
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
  header: { gap: 24 },
  content: { paddingBottom: 40 },
  empty: { marginTop: 48 },
});
