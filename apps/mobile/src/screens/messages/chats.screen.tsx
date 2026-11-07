import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchConversationListAndSaveLocally, readSavedConversationsForInstantDisplay } from "@/cache/messageSync.util";
import { ChatSearchPanel } from "@/components/chat/chatSearchPanel";
import { ChatsOptionsMenu } from "@/components/chat/chatsOptionsMenu";
import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { ChatsEmptyState } from "@/components/chat/chatsEmptyState";
import { ChatLockGate } from "@/components/chatSafety/chatLockGate";
import { InboxFolderMenu } from "@/components/chatSafety/inboxFolderMenu";
import { InboxRequestActions } from "@/components/chatSafety/inboxRequestActions";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { messagesService } from "@/services/chat/messages.service";
import { ChatsSkeleton } from "@/components/chat/chatsSkeleton";
import { ConversationRow } from "@/components/chat/conversationRow";
import { SmallTab } from "@/components/chat/smallTab";
import { StoryTray } from "@/components/chat/storyTray";
import { ArrowLeft24Icon, DotsThreeVertical24Icon, MagnifyingGlass24Icon, WechatLogo48Icon } from "@/components/icons";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { storiesService } from "@/services/clips/stories.service";
import { liveService } from "@/services/live/live.service";
import { useAuthStore } from "@/store/auth.store";
import type { ConversationFilter, InboxFolder } from "@/types";

export function ChatsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [folder, setFolder] = useState<InboxFolder>("chats");
  const [isSearching, setIsSearching] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const myAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const conversations = useQuery({
    queryKey: ["conversations", filter, folder],
    queryFn: () => (folder === "chats" ? fetchConversationListAndSaveLocally(filter) : messagesService.fetchInboxFolder(folder)),
    placeholderData: () => {
      if (folder !== "chats") return undefined;
      const savedConversations = readSavedConversationsForInstantDisplay(filter);
      return savedConversations.length > 0 ? savedConversations : undefined;
    },
  });
  const storyTray = useQuery({ queryKey: ["story-tray"], queryFn: storiesService.fetchStoryTray });
  const suggestedLives = useQuery({ queryKey: ["suggested-lives"], queryFn: liveService.fetchSuggestedLives });

  const isEmpty = conversations.isSuccess && conversations.data.length === 0;
  const goBackFromChats = () => (isSearching ? setIsSearching(false) : navigation.navigate("Tabs", { screen: "Home" }));

  return (
    <Screen background={isEmpty ? colors.background : colors.surface}>
      <ChatLockGate>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={goBackFromChats}>
            <ArrowLeft24Icon />
          </Pressable>
          {isSearching ? null : <InboxFolderMenu folder={folder} topOffset={insets.top + 44} titleSize={isEmpty ? 18 : 21} onSelect={setFolder} />}
        </View>
        <View style={styles.headerRight}>
          {isSearching ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel="Search chats" hitSlop={10} onPress={() => setIsSearching(true)}>
              <MagnifyingGlass24Icon />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={10} onPress={() => setIsOptionsMenuVisible(true)}>
            <DotsThreeVertical24Icon />
          </Pressable>
        </View>
      </View>

      {isSearching ? (
        <ChatSearchPanel
          onOpenConversation={(conversationId, name) => navigation.navigate("Chat", { conversationId, name })}
          onOpenPerson={(person) => navigation.navigate("Chat", { userId: person.id, name: person.name })}
        />
      ) : conversations.isLoading ? (
        <View style={styles.skeleton}>{folder === "chats" ? <ChatsSkeleton /> : <ListSkeleton avatarSize={56} />}</View>
      ) : conversations.isError && !conversations.data ? (
        <ErrorState error={conversations.error} message="Couldn't load your messages." onRetry={() => conversations.refetch()} />
      ) : (
        <FlatList
          data={conversations.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
          refreshing={conversations.isRefetching}
          onRefresh={() => conversations.refetch()}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.tray}>
                <StoryTray
                  items={storyTray.data ?? []}
                  liveItems={suggestedLives.data ?? []}
                  myAvatarUrl={myAvatarUrl}
                  onPressAddStory={() => navigation.navigate("CreatePost", { mode: "story" })}
                  onPressStory={(userId) => navigation.navigate("Story", { userId })}
                  onPressLive={(liveId) => navigation.navigate("Live", { liveId })}
                />
              </View>
              {folder === "chats" ? (
                <View style={styles.tabs} accessibilityRole="tablist">
                  <SmallTab label="All Messages" selected={filter === "all"} onPress={() => setFilter("all")} />
                  <SmallTab label="Direct Messages" selected={filter === "direct"} onPress={() => setFilter("direct")} />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            folder === "chats" ? (
              <ChatsEmptyState />
            ) : (
              <Text size={14} lineHeight={20} color={colors.textMuted} align="center" style={styles.emptyFolder}>
                {folder === "requests" ? "No message requests." : "No chats flagged as spam."}
              </Text>
            )
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ConversationRow
                conversation={item}
                onPress={() => navigation.navigate("Chat", { conversationId: item.id, name: describeConversationForDisplay(item).displayName })}
              />
              {folder === "chats" ? null : <InboxRequestActions conversation={item} showExplanation />}
            </View>
          )}
        />
      )}

      {isSearching ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New message"
          onPress={() => navigation.navigate("NewMessage")}
          style={styles.compose}
        >
          <WechatLogo48Icon />
        </Pressable>
      )}
      <ChatsOptionsMenu
        visible={isOptionsMenuVisible}
        topOffset={insets.top + 44}
        onClose={() => setIsOptionsMenuVisible(false)}
        onCreateGroup={() => navigation.navigate("NewGroup", { kind: "group" })}
        onCreateChannel={() => navigation.navigate("NewGroup", { kind: "channel" })}
        onOpenInvitations={() => navigation.navigate("GroupInvitations")}
        onOpenChannelInvitations={() => navigation.navigate("ChannelInvitations")}
        onOpenSettings={() => navigation.navigate("ChatSettings")}
      />
      </ChatLockGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 12, height: 25, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 11 },
  skeleton: { flex: 1, marginTop: 16 },
  emptyFolder: { marginTop: 80 },
  list: { paddingBottom: 96 },
  listEmpty: { flexGrow: 1 },
  listHeader: { paddingTop: 16 },
  tray: { minHeight: 81 },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
  rowWrap: { paddingHorizontal: 16 },
  separator: { height: 12 },
  compose: { position: "absolute", right: 12, bottom: 15 },
});
