import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, View } from "react-native";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { removeExpiredMessagesFromCaches } from "@/cache/messageRealtimeCache.util";
import { readSavedMessagesForInstantDisplay, syncConversationHistoryUntilMessage, syncConversationMessagesIncrementallyAndReadLocalHistory } from "@/cache/messageSync.util";
import { ChatBubble } from "@/components/chat/chatBubble";
import { foldConversationMessages } from "@/components/chat/chatControlFold.util";
import { ChatComposerWithVoiceNotes } from "@/components/chat/chatComposerWithVoiceNotes";
import { SecurityCodeChangedBanner } from "@/components/chatSafety/securityCode";
import { ChatHeader } from "@/components/chat/chatHeader";
import { asSeenFromStoreChat, describeConversationForDisplay, describeDisappearingMessagesDuration } from "@/components/chat/conversationDisplay.util";
import { ConversationIntro } from "@/components/chat/conversationIntro";
import { ChatActionsMenu } from "@/components/chatReport/chatActionsMenu";
import { useChatReportLauncher } from "@/components/chatReport/chatReportLauncher.hook";
import { ChatLockGate } from "@/components/chatSafety/chatLockGate";
import { ChatMuteSheet } from "@/components/chatSafety/chatMuteSheet";
import { InboxRequestActions } from "@/components/chatSafety/inboxRequestActions";
import { StreakMilestoneCelebration } from "@/components/chatSafety/streakMilestoneCelebration";
import { StreakSheet } from "@/components/chatSafety/streakSheet";
import { chatSafetyService } from "@/services/chat/chatSafety.service";
import { MessageReactionPicker } from "@/components/chat/messageReactionPicker";
import { useMessageReactionToggle } from "@/components/chat/messageReactions.hook";
import { useOptimisticChatMessageSender } from "@/components/chat/optimisticChatMessageSender.hook";
import { useOptimisticImageMessageSender } from "@/components/chat/optimisticImageMessageSender.hook";
import { useOptimisticDocumentSender } from "@/components/chat/optimisticDocumentSender.hook";
import { useOptimisticLocationAndPollSender } from "@/components/chat/optimisticLocationAndPollSender.hook";
import { useOptimisticVoiceNoteSender } from "@/components/chat/optimisticVoiceNoteSender.hook";
import { useUsersTypingInConversation } from "@/components/chat/typingIndicators.store";
import { TypingDots } from "@/components/chat/typingDots";
import { BrandLoader } from "@/components/ui/brandLoader";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { messagesService } from "@/services/chat/messages.service";
import { realtimeService } from "@/services/core/realtime.service";
import { useAuthStore } from "@/store/auth.store";

const EXPIRED_MESSAGE_SWEEP_INTERVAL_MS = 30_000;

function TypingRow() {
  const styles = useStyles();
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
  const { colors } = useTheme();
  const styles = useStyles();
  const { userId, name } = route.params;
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id ?? "u_me");
  const listRef = useRef<FlatList<LocallyStoredMessage>>(null);
  const targetMessageAttempted = useRef<string | null>(null);
  const targetMessageScrolled = useRef<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [messageBeingReactedTo, setMessageBeingReactedTo] = useState<LocallyStoredMessage | null>(null);
  const [isMuteSheetOpen, setIsMuteSheetOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isStreakSheetOpen, setIsStreakSheetOpen] = useState(false);
  const [isCelebrationDismissed, setIsCelebrationDismissed] = useState(false);

  const conversation = useQuery({
    queryKey: ["conversation", route.params.conversationId ?? (route.params.storeId ? `store:${route.params.storeId}` : `user:${userId}`)],
    queryFn: () =>
      route.params.conversationId
        ? messagesService.fetchConversationById(route.params.conversationId)
        : route.params.storeId
          ? messagesService.openStoreConversation(route.params.storeId)
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
    if (conversationId && conversation.data?.inboxFolder !== "requests" && conversation.data?.inboxFolder !== "spam") {
      messagesService.markConversationAsRead(conversationId).catch(() => undefined);
    }
  }, [conversationId, conversation.data?.inboxFolder]);

  useEffect(() => (conversationId ? realtimeService.subscribeToTopic(`conversation:${conversationId}`) : undefined), [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const sweepTimer = setInterval(() => removeExpiredMessagesFromCaches(queryClient, conversationId), EXPIRED_MESSAGE_SWEEP_INTERVAL_MS);
    return () => clearInterval(sweepTimer);
  }, [conversationId, queryClient]);

  const report = useChatReportLauncher(conversation.data);
  const sendMessageOptimistically = useOptimisticChatMessageSender(conversationId, myUserId);
  const sendVoiceNoteOptimistically = useOptimisticVoiceNoteSender(conversationId, myUserId);
  const sendImageOptimistically = useOptimisticImageMessageSender(conversationId, myUserId);
  const { sendCurrentLocation, startSharingLiveLocation, sendPoll } = useOptimisticLocationAndPollSender(conversationId, myUserId);
  const { sendDocument, retryDocument, discardDocument } = useOptimisticDocumentSender(conversationId, myUserId);
  const toggleReactionOnMessage = useMessageReactionToggle(conversationId);

  const display = conversation.data ? describeConversationForDisplay(conversation.data) : null;
  const isGroupLike = !!display && (display.isGroup || display.isChannel);
  const peer = display?.isBusiness ? undefined : conversation.data?.peer;
  const folded = useMemo(() => foldConversationMessages(messages.data ?? [], myUserId), [messages.data, myUserId]);
  const items = folded.visibleMessages;
  const newestFirstItems = useMemo(() => [...items].reverse(), [items]);
  const { refetch: refetchConversation } = conversation;
  const needsGroupKeyRefresh = folded.groupUpdateCount > 0 && conversation.data?.kind === "group" && !conversation.data.hasGroupKey;
  useEffect(() => {
    if (needsGroupKeyRefresh) void refetchConversation();
  }, [needsGroupKeyRefresh, folded.groupUpdateCount, refetchConversation]);
  const isThreadLoading = !messages.data?.length && (conversation.isLoading || messages.isLoading);
  const disappearingSeconds = conversation.data?.disappearingMessagesSeconds ?? null;
  const isMyMessage = (message: LocallyStoredMessage) => message.senderId === myUserId || message.senderId === "u_me";
  const inboxFolder = conversation.data?.inboxFolder ?? "chats";
  const streak = conversation.data?.streak ?? null;
  const isComposerReplacedByNotice =
    (!!conversation.data && inboxFolder !== "chats") || (!isGroupLike && peer?.account?.status === "suspended") || (!!display && !display.canPostMessages);
  const dismissCelebration = () => {
    setIsCelebrationDismissed(true);
    if (conversationId) chatSafetyService.acknowledgeStreakCelebration(conversationId).catch(() => undefined);
  };
  const openConversationInfo = () => {
    if (conversationId) navigation.navigate("ConversationInfo", { conversationId });
  };

  useEffect(() => {
    const messageId = route.params.messageId;
    if (!messageId || !conversationId || messages.isLoading || messages.isFetching) return;
    const index = newestFirstItems.findIndex((message) => message.id === messageId);
    if (index >= 0) {
      if (targetMessageScrolled.current !== messageId) {
        targetMessageScrolled.current = messageId;
        setHighlightedMessageId(messageId);
        listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      }
      return;
    }
    if (targetMessageAttempted.current === messageId) return;
    targetMessageAttempted.current = messageId;
    void syncConversationHistoryUntilMessage(conversationId, messageId)
      .catch(() => false)
      .finally(() => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }));
  }, [route.params.messageId, conversationId, messages.isLoading, messages.isFetching, newestFirstItems, queryClient]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = setTimeout(() => setHighlightedMessageId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightedMessageId]);

  return (
    <Screen background={colors.surface} edges={["top"]}>
      <ChatLockGate>
      <View style={styles.flex}>
        <ChatHeader
          conversation={conversation.data}
          fallbackName={name}
          usersTyping={usersTyping}
          onGoBack={() => navigation.goBack()}
          onOpenConversationInfo={openConversationInfo}
          onOpenStreak={() => setIsStreakSheetOpen(true)}
          onOpenMute={() => setIsMuteSheetOpen(true)}
          onOpenOptionsMenu={() => setIsOptionsMenuOpen(true)}
        />
        {disappearingSeconds ? (
          <View style={styles.disappearingBanner}>
            <Text size={11} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
              Messages disappear {describeDisappearingMessagesDuration(disappearingSeconds)} after they&apos;re sent
            </Text>
          </View>
        ) : null}
        {peer && !isGroupLike ? <SecurityCodeChangedBanner peerIds={[peer.id]} peerName={peer.name} /> : null}

        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            style={styles.flex}
            data={newestFirstItems}
            inverted
            keyExtractor={(m) => m.id}
            onScrollToIndexFailed={({ averageItemLength, index }) => listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            ListFooterComponent={
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
            ListHeaderComponent={usersTyping.length > 0 && !isGroupLike ? <TypingRow /> : null}
            renderItem={({ item }) => (
              <ChatBubble
                message={display?.isBusiness && conversation.data ? asSeenFromStoreChat(item, conversation.data, myUserId) : item}
                deliveryStatus={item.deliveryStatus}
                isMine={isMyMessage(item)}
                showSenderIdentity={isGroupLike || !!display?.isBusiness}
                showReadReceipt={inboxFolder === "chats"}
                highlighted={item.id === highlightedMessageId}
                onLongPress={item.deliveryStatus === "sent" && item.kind !== "system" ? () => setMessageBeingReactedTo(item) : undefined}
                onToggleReaction={(emoji, shouldReact) => toggleReactionOnMessage(item, emoji, shouldReact).catch(() => undefined)}
                onRetryDocument={() => void retryDocument(item.id)}
                onDiscardDocument={() => discardDocument(item.id)}
              />
            )}
          />
          {isThreadLoading ? <BrandLoader accessibilityLabel="Loading messages" style={styles.threadLoader} /> : null}
        </View>

        {conversation.data && inboxFolder !== "chats" ? (
          <View style={styles.readOnlyNotice}>
            <InboxRequestActions conversation={conversation.data} showExplanation onRemoved={() => navigation.goBack()} />
          </View>
        ) : !isGroupLike && peer?.account?.status === "suspended" ? (
          <View style={styles.readOnlyNotice}>
            <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center">
              You can&apos;t message this account
            </Text>
          </View>
        ) : display && !display.canPostMessages ? (
          <View style={styles.readOnlyNotice}>
            <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center">
              Only admins can post in this channel. Long press a post to react.
            </Text>
          </View>
        ) : (
          <ChatComposerWithVoiceNotes
            mentionConversation={
              conversationId && (conversation.data?.kind === "group" || !conversation.data?.kind || conversation.data.kind === "direct")
                ? { id: conversationId, surface: conversation.data?.kind === "group" ? "group" : "direct" }
                : undefined
            }
            onSendText={(text, mentions) => sendMessageOptimistically(text, mentions).catch(() => undefined)}
            onSendVoiceNote={(voiceNote) => sendVoiceNoteOptimistically(voiceNote).catch(() => undefined)}
            onSendImage={(image) => sendImageOptimistically(image).catch(() => undefined)}
            onSendLocation={(location) => void sendCurrentLocation(location)}
            onStartLiveLocation={(location, durationMinutes) => void startSharingLiveLocation(location, durationMinutes)}
            onSendDocument={(document) => void sendDocument(document)}
            onSendPoll={(poll) => void sendPoll(poll)}
            onTypingChange={(isTyping) => {
              if (conversationId) realtimeService.sendTypingSignal(conversationId, isTyping);
            }}
          />
        )}
        {isComposerReplacedByNotice ? <KeyboardSpacer /> : null}
        {streak?.milestoneCelebrationPending && !isCelebrationDismissed && peer ? (
          <StreakMilestoneCelebration milestoneDays={streak.milestoneDays ?? 0} peerName={peer.name} onDismiss={dismissCelebration} />
        ) : null}
      </View>
      {conversationId && peer && streak && streak.state !== "none" ? (
        <StreakSheet visible={isStreakSheetOpen} onClose={() => setIsStreakSheetOpen(false)} conversationId={conversationId} streak={streak} peerName={peer.name} />
      ) : null}
      <ChatActionsMenu
        visible={isOptionsMenuOpen}
        conversation={conversation.data}
        isGroupLike={isGroupLike}
        onClose={() => setIsOptionsMenuOpen(false)}
        onOpenConversationInfo={openConversationInfo}
        onBlocked={() => navigation.goBack()}
        report={report}
      />
      {report.reportSheet}
      {conversationId ? <ChatMuteSheet visible={isMuteSheetOpen} onClose={() => setIsMuteSheetOpen(false)} conversationId={conversationId} isMuted={!!conversation.data?.mutedUntil} /> : null}
      </ChatLockGate>
      <MessageReactionPicker
        visible={!!messageBeingReactedTo}
        onClose={() => setMessageBeingReactedTo(null)}
        onPickEmoji={(emoji) => {
          if (messageBeingReactedTo) toggleReactionOnMessage(messageBeingReactedTo, emoji, true).catch(() => undefined);
          setMessageBeingReactedTo(null);
        }}
        onReportMessage={
          messageBeingReactedTo && !isMyMessage(messageBeingReactedTo)
            ? () => {
                const reportedMessage = messageBeingReactedTo;
                setMessageBeingReactedTo(null);
                setTimeout(() => report.reportMessage(reportedMessage, reportedMessage.sender ?? null), 350);
              }
            : undefined
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  disappearingBanner: { marginTop: 8, paddingHorizontal: 24 },
  dayDivider: { gap: 12, marginBottom: 10, marginTop: 8 },
  line: { height: 0.5, backgroundColor: colors.divider },
  bubbleGap: { height: 4 },
  typingRow: { paddingHorizontal: 20, paddingTop: 4, flexDirection: "row", justifyContent: "flex-start" },
  listContent: { paddingTop: 12 },
  threadLoader: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface },
  readOnlyNotice: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.divider },
}));
