import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatCircleDots, GearSix, BookOpenText } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { InboxScreen } from "../screens/InboxScreen";
import { StoriesScreen } from "../screens/StoriesScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { messengerTheme } from "../theme";
import { BrandLockup } from "../ui/BrandLockup";
import { NavItem } from "../ui/NavItem";
import { ConversationScreen } from "../screens/ConversationScreen";
import { FloatingConversationBubbles } from "../ui/FloatingConversationBubbles";
import { getChatBubblePreferences, saveChatBubblePreferences, type ChatBubblePreferences } from "../api/chatBubblePreferences.service";
import { toggleInAppConversation } from "../api/chatBubblePreferences.util";
import { parseConversationList, type ConversationSummary } from "../api/conversations";
import { conversationIdFromUrl, isBubbleTestUrl, isCompactBubbleUrl, subscribeToConversationOpen } from "./notificationNavigation.service";
import { subscribeToMessengerEvents } from "../api/messengerRealtime.service";

export type MessengerSection = "chats" | "stories" | "settings";

const navigationItems = [
  { key: "chats", label: "Chats", Icon: ChatCircleDots },
  { key: "stories", label: "Stories", Icon: BookOpenText },
  { key: "settings", label: "Settings", Icon: GearSix },
] as const;

export function MessengerAppShell() {
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const [section, setSection] = useState<MessengerSection>("chats");
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [compactBubble, setCompactBubble] = useState(false);
  const [compactBubbleTest, setCompactBubbleTest] = useState(false);
  const [bubbles, setBubbles] = useState<readonly ConversationSummary[]>([]);
  const [bubblePreferences, setBubblePreferences] = useState<ChatBubblePreferences | null>(null);
  const bubblePreferencesRef = useRef<ChatBubblePreferences | null>(null);
  const systemScheme = useColorScheme();
  const colors = systemScheme === "dark" ? messengerTheme.dark : messengerTheme.light;
  const { user, request } = useMessengerAuth();
  useEffect(() => { bubblePreferencesRef.current = bubblePreferences; }, [bubblePreferences]);

  useEffect(() => {
    if (section !== "chats") return;
    let active = true;
    void Promise.all([getChatBubblePreferences(), request<{ readonly notifications?: { readonly bubbles?: boolean; readonly bubbleMode?: "all" | "selected"; readonly bubbleConversationIds?: readonly string[]; readonly bubbleExcludedConversationIds?: readonly string[] } }>("/api/v1/chat/settings")]).then(async ([stored, settings]) => {
      const notifications = settings.notifications;
      const preferences = notifications ? {
        ...stored,
        enabled: notifications.bubbles ?? stored.enabled,
        mode: notifications.bubbleMode ?? stored.mode,
        conversationIds: notifications.bubbleConversationIds ?? stored.conversationIds,
        excludedConversationIds: notifications.bubbleExcludedConversationIds ?? stored.excludedConversationIds,
      } : stored;
      await saveChatBubblePreferences(preferences);
      if (!active) return;
      setBubblePreferences(preferences);
      if (!preferences.inAppEnabled || preferences.inAppConversationIds.length === 0) { setBubbles([]); return; }
      try {
        const result = await request<unknown>("/api/v1/conversations?filter=all");
        const list = parseConversationList(result);
        if (!active) return;
        setBubbles(list.filter(({ id }) => preferences.inAppConversationIds.includes(id)).slice(0, 4));
      } catch { /* Selected bubble preferences remain available when the inbox reconnects. */ }
    });
    return () => { active = false; };
  }, [request, section]);
  useEffect(() => {
    if (!user?.id) return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    return subscribeToMessengerEvents(request, (event) => {
      if (event.type !== "message.created" && event.type !== "conversation.updated" && event.type !== "read") return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void request<unknown>("/api/v1/conversations?filter=all").then((result) => {
          const list = parseConversationList(result);
          const preferences = bubblePreferencesRef.current;
          if (!preferences?.inAppEnabled) return;
          setBubbles(list.filter(({ id }) => preferences.inAppConversationIds.includes(id)).slice(0, 4));
        }).catch(() => undefined);
      }, 240);
    });
  }, [request, user?.id]);
  const openConversationById = useCallback(async (conversationId: string, compact = false) => {
    setCompactBubble(compact);
    setSection("chats");
    try {
      const result = await request<unknown>("/api/v1/conversations?filter=all");
      const found = parseConversationList(result).find((item) => item.id === conversationId);
      if (found) setSelectedConversation(found);
    } catch { /* The inbox will surface the authenticated retry path. */ }
  }, [request]);

  useEffect(() => subscribeToConversationOpen((conversationId) => { void openConversationById(conversationId); }), [openConversationById]);
  useEffect(() => {
    const receiveUrl = ({ url }: { readonly url: string }) => {
      setCompactBubbleTest(isBubbleTestUrl(url));
      const conversationId = conversationIdFromUrl(url);
      if (conversationId) void openConversationById(conversationId, isCompactBubbleUrl(url));
    };
    const subscription = Linking.addEventListener("url", receiveUrl);
    void Linking.getInitialURL().then((url) => { if (url) receiveUrl({ url }); }).catch(() => undefined);
    return () => subscription.remove();
  }, [openConversationById]);

  const toggleBubble = useCallback(async (conversation: ConversationSummary) => {
    const isActive = bubbles.some((item) => item.id === conversation.id);
    if (bubblePreferences) {
      const saved = { ...bubblePreferences, inAppEnabled: true, inAppConversationIds: toggleInAppConversation(bubblePreferences.inAppConversationIds, conversation.id) };
      try { await saveChatBubblePreferences(saved); setBubblePreferences(saved); }
      catch (cause) { Alert.alert("Could not update in-app chats", cause instanceof Error ? cause.message : "Try again."); return; }
    }
    setBubbles((current) => isActive
      ? current.filter((item) => item.id !== conversation.id)
      : [...current, conversation].slice(-4));
  }, [bubblePreferences, bubbles]);

  const visibleBubbles = bubblePreferences?.inAppEnabled
    ? bubbles.filter(({ id }) => bubblePreferences.inAppConversationIds.includes(id))
    : [];

  if (compactBubbleTest) {
    return <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.compactTest, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ChatCircleDots size={28} color={colors.brand} />
        <TextLabel color={colors.text}>Local chat bubble test</TextLabel>
        <Text style={[styles.compactTestCopy, { color: colors.muted }]}>This local test did not send or add a message to any conversation.</Text>
        <Pressable accessibilityRole="button" onPress={() => setCompactBubbleTest(false)} style={[styles.compactTestAction, { borderColor: colors.border }]}>
          <TextLabel color={colors.text}>Close test</TextLabel>
        </Pressable>
      </View>
    </SafeAreaView>;
  }

  if (compactBubble) {
    return <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.compactRoot}>
        {selectedConversation ? <ConversationScreen
          conversation={selectedConversation}
          compact
          onClose={() => { setCompactBubble(false); setSelectedConversation(null); }}
          onOpenFull={() => setCompactBubble(false)}
        /> : <View style={[styles.compactLoading, { backgroundColor: colors.background }]}>
          <TextLabel color={colors.muted}>Opening secure conversation…</TextLabel>
        </View>}
      </View>
    </SafeAreaView>;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.frame, isWide && styles.wideFrame]}>
        {isWide ? (
          <View style={[styles.rail, { borderRightColor: colors.border, backgroundColor: colors.surface }]}>
            <BrandLockup compact />
            <View style={styles.railItems}>
              {navigationItems.map(({ key, label, Icon }) => (
                <NavItem key={key} label={label} Icon={Icon} selected={section === key} onPress={() => setSection(key)} vertical />
              ))}
            </View>
          <View style={[styles.railAccount, { borderTopColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.brandTint }]}>
                <ChatCircleDots size={18} color={colors.brand} weight="fill" />
              </View>
              <View style={styles.accountCopy}>
                <TextLabel color={colors.text} numberOfLines={1}>{user?.name || user?.username || "Nantty account"}</TextLabel>
                {user?.username ? <TextLabel color={colors.muted} numberOfLines={1}>@{user.username}</TextLabel> : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.content}>
          {selectedConversation ? <ConversationScreen conversation={selectedConversation} onBack={() => setSelectedConversation(null)} onToggleBubble={() => toggleBubble(selectedConversation)} isBubbleActive={visibleBubbles.some(({ id }) => id === selectedConversation.id)} /> : null}
          {!selectedConversation && section === "chats" ? <InboxScreen onOpenConversation={setSelectedConversation} onFloatConversation={toggleBubble} /> : null}
          {section === "stories" ? <StoriesScreen /> : null}
          {section === "settings" ? <SettingsScreen /> : null}
          {!isWide ? (
            <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              {navigationItems.map(({ key, label, Icon }) => (
                <NavItem key={key} label={label} Icon={Icon} selected={section === key} onPress={() => setSection(key)} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {bubblePreferences?.inAppEnabled && section === "chats" && !selectedConversation ? (
        <FloatingConversationBubbles
          conversations={visibleBubbles}
          onDismiss={(conversationId) => {
            const conversation = bubbles.find(({ id }) => id === conversationId);
            if (conversation) void toggleBubble(conversation);
          }}
          onOpenFull={setSelectedConversation}
          showUnreadCount={bubblePreferences.showUnreadCount}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TextLabel({ children, color, numberOfLines }: { readonly children: ReactNode; readonly color: string; readonly numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={{ color, fontSize: 13 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: { flex: 1, flexDirection: "row" },
  wideFrame: { maxWidth: 1440, alignSelf: "center", width: "100%" },
  rail: { width: 248, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 24 },
  railItems: { gap: 8, marginTop: 38 },
  railAccount: { marginTop: "auto", paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1, gap: 2 },
  content: { flex: 1, minWidth: 0 },
  compactRoot: { flex: 1, minWidth: 0 },
  compactLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  compactTest: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20, borderWidth: StyleSheet.hairlineWidth },
  compactTestCopy: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  compactTestAction: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  bottomNav: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingBottom: 3 },
});
