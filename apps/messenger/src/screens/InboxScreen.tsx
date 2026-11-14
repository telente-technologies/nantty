import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, type ImageStyle } from "react-native";
import { ChatCircleDots, MagnifyingGlass, WarningCircle } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/apiClient";
import { conversationAvatarUrl, conversationDisplayName, formatConversationTime, parseConversationList, type ConversationSummary } from "../api/conversations";
import { useMessengerColors } from "../ui/useMessengerColors";
import { StatePanel } from "../ui/StatePanel";
import { subscribeToMessengerEvents } from "../api/messengerRealtime.service";

type InboxState = "loading" | "ready" | "error";

export function InboxScreen({ onOpenConversation, onFloatConversation }: { readonly onOpenConversation?: (conversation: ConversationSummary) => void; readonly onFloatConversation?: (conversation: ConversationSummary) => void }) {
  const colors = useMessengerColors();
  const { request } = useMessengerAuth();
  const [conversations, setConversations] = useState<readonly ConversationSummary[]>([]);
  const [state, setState] = useState<InboxState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    else setState("loading");
    setError(null);
    try {
      const payload = await request<unknown>("/api/v1/conversations?filter=all");
      setConversations(parseConversationList(payload));
      setState("ready");
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Could not load your conversations.";
      setError(message);
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);
  useEffect(() => subscribeToMessengerEvents(request, (event) => {
    if (event.type === "message.created" || event.type === "conversation.updated" || event.type === "read") void loadConversations(true);
  }), [loadConversations, request]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase();
    if (!normalizedQuery) return conversations;
    return conversations.filter((conversation) => {
      const name = conversationDisplayName(conversation).toLocaleLowerCase();
      const username = conversation.peer.username.toLocaleLowerCase();
      const lastMessage = conversation.lastMessage.toLocaleLowerCase();
      return name.includes(normalizedQuery) || username.includes(normalizedQuery) || lastMessage.includes(normalizedQuery);
    });
  }, [conversations, search]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.brand }]}>NANTTY MESSENGER</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Chats</Text>
        </View>
        <View style={[styles.headerMark, { backgroundColor: colors.brandTint }]}>
          <ChatCircleDots size={23} color={colors.brand} weight="fill" />
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MagnifyingGlass size={19} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search conversations"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="Search chats"
          placeholderTextColor={colors.subtle}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
        />
      </View>

      {state === "loading" ? (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading conversations">
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Loading your conversations…</Text>
        </View>
      ) : state === "error" ? (
        <StatePanel Icon={WarningCircle} title="Inbox unavailable" description={error ?? "Could not load your conversations."} actionLabel="Retry" onAction={() => void loadConversations()} tone="error" />
      ) : conversations.length === 0 ? (
        <StatePanel Icon={ChatCircleDots} title="No conversations yet" description="When you message someone on Nantty, your shared conversation will appear here." />
      ) : filteredConversations.length === 0 ? (
        <StatePanel Icon={MagnifyingGlass} title="No matches" description={`No conversations match “${search.trim()}”. Try another name or message.`} />
      ) : (
        <FlatList
          accessibilityLabel="Conversation list"
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadConversations(true)} tintColor={colors.brand} colors={[colors.brand]} />}
          renderItem={({ item }) => <ConversationRow conversation={item} onOpen={() => onOpenConversation?.(item)} onFloat={() => onFloatConversation?.(item)} />}
        />
      )}
    </View>
  );
}

function ConversationRow({ conversation, onOpen, onFloat }: { readonly conversation: ConversationSummary; readonly onOpen?: () => void; readonly onFloat?: () => void }) {
  const colors = useMessengerColors();
  const displayName = conversationDisplayName(conversation);
  const avatarUrl = conversationAvatarUrl(conversation);
  const initials = displayName.trim().slice(0, 1).toLocaleUpperCase() || "N";
  const summary = conversation.lastMessage.trim() || "No messages yet";
  const time = formatConversationTime(conversation.lastMessageAt);

  return (
    <View style={styles.rowContainer}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${displayName}. ${summary}${conversation.unread > 0 ? `, ${conversation.unread} unread` : ""}`} onPress={onOpen} style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.brandTint }]}>
        {avatarUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: avatarUrl }} style={styles.avatarImage as ImageStyle} /> : <Text style={[styles.initial, { color: colors.brand }]}>{initials}</Text>}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{displayName}</Text>
            {conversation.peer.verified ? <View style={[styles.verified, { backgroundColor: colors.brand }]} accessibilityLabel="Verified account"><Text style={styles.check}>✓</Text></View> : null}
          </View>
          <Text style={[styles.time, { color: colors.subtle }]}>{time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text numberOfLines={1} style={[styles.preview, { color: colors.muted }]}>{summary}</Text>
          {conversation.unread > 0 ? (
            <View style={[styles.unread, { backgroundColor: colors.brand }]}>
              <Text style={[styles.unreadText, { color: colors.onBrand }]}>{conversation.unread > 99 ? "99+" : conversation.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${onFloat ? "Toggle" : "Open"} ${displayName} in in-app floating chats`} onPress={onFloat} hitSlop={7} style={styles.floatAction}>
        <ChatCircleDots size={19} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  header: { minHeight: 82, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -0.6 },
  headerMark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  searchBox: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 13, marginHorizontal: 18, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  list: { paddingHorizontal: 18, paddingBottom: 12 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 68, marginVertical: 9 },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12 },
  rowContainer: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 8 },
  floatAction: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  initial: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  rowBody: { flex: 1, minWidth: 0, gap: 5 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  nameLine: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 5 },
  name: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  verified: { width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  check: { color: "#FFFFFF", fontSize: 10, lineHeight: 12, fontWeight: "800" },
  time: { fontSize: 11, lineHeight: 16 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontSize: 13, lineHeight: 18 },
  unread: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 10, fontWeight: "700" },
});
