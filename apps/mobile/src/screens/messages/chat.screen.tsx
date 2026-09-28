import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";

import { ChatBubble } from "@/components/chat/chatBubble";
import { ConversationIntro } from "@/components/chat/conversationIntro";
import { MessageComposerBar } from "@/components/chat/messageComposerBar";
import { ArrowLeft24Icon, DotsThreeVertical24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { messagesService } from "@/services/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Message } from "@/types";

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
  const listRef = useRef<FlatList<Message>>(null);

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
    queryFn: () => messagesService.fetchMessagesInConversation(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (conversationId) messagesService.markConversationAsRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  const sendMessage = useMutation({
    mutationFn: (text: string) => messagesService.sendChatMessageToConversation(conversationId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const peer = conversation.data?.peer;
  const items = messages.data?.data ?? [];

  return (
    <Screen background={colors.white}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => navigation.goBack()}>
              <ArrowLeft24Icon />
            </Pressable>
            <View style={styles.peer}>
              <Avatar uri={peer?.avatarUrl} size={24} placeholderColor={colors.placeholder} />
              <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
                {peer?.name ?? name}
              </Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={10}>
            <DotsThreeVertical24Icon />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          style={styles.flex}
          data={items}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            peer ? (
              <View>
                <ConversationIntro
                  peer={peer}
                  isFriend={conversation.data?.isFriend ?? false}
                  onPressViewProfile={() => navigation.navigate("UserProfile", { userId: peer.id })}
                />
                {items.length > 0 ? (
                  <View style={styles.dayDivider}>
                    <View style={styles.line} />
                    <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
                      {formatConversationDayLabel(items[0]!.createdAt)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.bubbleGap} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ChatBubble message={item} isMine={item.senderId === myUserId || item.senderId === "u_me"} />}
        />

        <MessageComposerBar sending={sendMessage.isPending} onSend={(text) => sendMessage.mutate(text)} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: 12, height: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18, flexShrink: 1 },
  peer: { flexDirection: "row", alignItems: "center", gap: 13, flexShrink: 1 },
  dayDivider: { gap: 12, marginBottom: 10 },
  line: { height: 0.5, backgroundColor: colors.divider },
  bubbleGap: { height: 4 },
  listContent: { paddingBottom: 12 },
});
