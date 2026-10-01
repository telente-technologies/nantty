import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { removeExpiredMessagesFromCaches } from "@/cache/messageRealtimeCache.util";
import { readSavedMessagesForInstantDisplay, syncConversationMessagesIncrementallyAndReadLocalHistory } from "@/cache/messageSync.util";
import { ChatBubble } from "@/components/chat/chatBubble";
import { ChatComposerWithVoiceNotes } from "@/components/chat/chatComposerWithVoiceNotes";
import { ChatHeader } from "@/components/chat/chatHeader";
import { describeConversationForDisplay, describeDisappearingMessagesDuration } from "@/components/chat/conversationDisplay.util";
import { ConversationIntro } from "@/components/chat/conversationIntro";
import { MessageReactionPicker } from "@/components/chat/messageReactionPicker";
import { useKeyboardInset } from "@/hooks/useKeyboardInset.hook";
import { useMessageReactionToggle } from "@/components/chat/messageReactions.hook";
import { useOptimisticChatMessageSender } from "@/components/chat/optimisticChatMessageSender.hook";
import { useOptimisticVoiceNoteSender } from "@/components/chat/optimisticVoiceNoteSender.hook";
import { useUsersTypingInConversation } from "@/components/chat/typingIndicators.store";
import { TypingDots } from "@/components/chat/typingDots";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { messagesService } from "@/services/messages.service";
import { realtimeService } from "@/services/realtime.service";
import { useAuthStore } from "@/store/auth.store";

const EXPIRED_MESSAGE_SWEEP_INTERVAL_MS = 30_000;

function TypingRow() {
  return (
    <View style={styles.typingRow}>
      <TypingDots />
    </View>
  );
}

const formatConversationDayLabel = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  return `${isToday ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
};

export function ChatScreen({ navigation, route }: MainScreenProps<"Chat">) {
  const { userId, name } = route.params;
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id ?? "u_me");
  const listRef = useRef<FlatList<LocallyStoredMessage>>(null);
  const [messageBeingReactedTo, setMessageBeingReactedTo] = useState<LocallyStoredMessage | null>(null);
  const { inset: keyboardInset, handleLayout } = useKeyboardInset();

  const conversation = useQuery({
    queryKey: ["conversation", route.params.conversationId ?? `user:${userId}`],
    queryFn: () =>
      route.params.conversationId
        ? messagesService.fetchConversationById(route.params.conversationId)
        : messagesService.startConversationWithUser(userId!),
  });
  const conversationId = conversation.data?.id;
  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => syncConversationMessagesIncrementallyAndReadLocalHistory(conversationId!),
    enabled: !!conversationId,
    placeholderData: () => (conversationId ? readSavedMessagesForInstantDisplay(conversationId) : undefined),
  });
  const usersTyping = useUsersTypingInConversation(conversationId);

  useEffect(() => {
    if (conversationId) messagesService.markConversationAsRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    if (keyboardInset > 0) listRef.current?.scrollToEnd({ animated: false });
  }, [keyboardInset]);

  useEffect(() => {
    if (!conversationId) return;
    const sweepTimer = setInterval(() => removeExpiredMessagesFromCaches(queryClient, conversationId), EXPIRED_MESSAGE_SWEEP_INTERVAL_MS);
    return () => clearInterval(sweepTimer);
  }, [conversationId, queryClient]);

  const sendMessageOptimistically = useOptimisticChatMessageSender(conversationId, myUserId);
  const sendVoiceNoteOptimistically = useOptimisticVoiceNoteSender(conversationId, myUserId);
  const toggleReactionOnMessage = useMessageReactionToggle(conversationId);

  const display = conversation.data ? describeConversationForDisplay(conversation.data) : null;
  const isGroupLike = !!display && (display.isGroup || display.isChannel);
  const peer = conversation.data?.peer;
  const items = messages.data ?? [];
  const disappearingSeconds = conversation.data?.disappearingMessagesSeconds ?? null;
  const isMyMessage = (message: LocallyStoredMessage) => message.senderId === myUserId || message.senderId === "u_me";
  const openConversationInfo = () => {
    if (conversationId) navigation.navigate("ConversationInfo", { conversationId });
  };

  return (
    <Screen background={colors.white} edges={["top", "bottom"]}>
      <View style={[styles.flex, { paddingBottom: keyboardInset }]} onLayout={handleLayout}>
        <ChatHeader
          conversation={conversation.data}
          fallbackName={name}
          usersTyping={usersTyping}
          onGoBack={() => navigation.goBack()}
          onOpenConversationInfo={openConversationInfo}
        />
        {disappearingSeconds ? (
          <View style={styles.disappearingBanner}>
            <Text size={11} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
              Messages disappear {describeDisappearingMessagesDuration(disappearingSeconds)} after they're sent
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          style={styles.flex}
          data={items}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View>
              {peer && !isGroupLike ? (
                <ConversationIntro
                  peer={peer}
                  isFriend={conversation.data?.isFriend ?? false}
                  onPressViewProfile={() => navigation.navigate("UserProfile", { userId: peer.id })}
                />
              ) : null}
              {items.length > 0 ? (
                <View style={styles.dayDivider}>
                  <View style={styles.line} />
                  <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
                    {formatConversationDayLabel(items[0]!.createdAt)}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.bubbleGap} />}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={usersTyping.length > 0 && !isGroupLike ? <TypingRow /> : null}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              deliveryStatus={item.deliveryStatus}
              isMine={isMyMessage(item)}
              showSenderIdentity={isGroupLike}
              onLongPress={item.deliveryStatus === "sent" && item.kind !== "system" ? () => setMessageBeingReactedTo(item) : undefined}
              onToggleReaction={(emoji, shouldReact) => toggleReactionOnMessage(item, emoji, shouldReact).catch(() => undefined)}
            />
          )}
        />

        {display && !display.canPostMessages ? (
          <View style={styles.readOnlyNotice}>
            <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center">
              Only admins can post in this channel. Long press a post to react.
            </Text>
          </View>
        ) : (
          <ChatComposerWithVoiceNotes
            onSendText={(text) => sendMessageOptimistically(text).catch(() => undefined)}
            onSendVoiceNote={(voiceNote) => sendVoiceNoteOptimistically(voiceNote).catch(() => undefined)}
            onTypingChange={(isTyping) => {
              if (conversationId) realtimeService.sendTypingSignal(conversationId, isTyping);
            }}
          />
        )}
      </View>
      <MessageReactionPicker
        visible={!!messageBeingReactedTo}
        onClose={() => setMessageBeingReactedTo(null)}
        onPickEmoji={(emoji) => {
          if (messageBeingReactedTo) toggleReactionOnMessage(messageBeingReactedTo, emoji, true).catch(() => undefined);
          setMessageBeingReactedTo(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disappearingBanner: { marginTop: 8, paddingHorizontal: 24 },
  dayDivider: { gap: 12, marginBottom: 10, marginTop: 8 },
  line: { height: 0.5, backgroundColor: colors.divider },
  bubbleGap: { height: 4 },
  typingRow: { paddingHorizontal: 20, paddingTop: 4, flexDirection: "row", justifyContent: "flex-start" },
  listContent: { paddingBottom: 12 },
  readOnlyNotice: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.divider },
});
