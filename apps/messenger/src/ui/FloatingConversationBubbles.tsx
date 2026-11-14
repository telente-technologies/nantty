import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { conversationAvatarUrl, conversationDisplayName, type ConversationSummary } from "../api/conversations";
import { ConversationScreen } from "../screens/ConversationScreen";
import { getBubblePosition, saveBubblePosition } from "../api/chatBubblePreferences.service";
import { updateConversationDraft } from "../api/chatBubblePreferences.util";
import { useMessengerAuth } from "../auth/AuthProvider";
import { getBubbleDraft, saveBubbleDraft } from "../api/messengerChat.service";
import { useMessengerColors } from "./useMessengerColors";

interface FloatingConversationBubblesProps {
  readonly conversations: readonly ConversationSummary[];
  readonly onDismiss: (conversationId: string) => void;
  readonly onOpenFull: (conversation: ConversationSummary) => void;
  readonly showUnreadCount: boolean;
}

interface BubblePosition { readonly x: number; readonly y: number }

export function FloatingConversationBubbles({ conversations, onDismiss, onOpenFull, showUnreadCount }: FloatingConversationBubblesProps) {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useMessengerAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedPositions, setSavedPositions] = useState<Record<string, BubblePosition>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef<Record<string, string>>({});
  const draftTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const loadedDraftIds = useRef(new Set<string>());
  const draftAccountId = useRef(user?.id ?? null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const activeConversation = conversations.find(({ id }) => id === expandedId) ?? null;
  const initial = useMemo(() => ({ x: Math.max(12, width - 70), y: Math.max(insets.top + 70, height - insets.bottom - 150) }), [height, insets.bottom, insets.top, width]);

  useEffect(() => {
    const accountId = user?.id ?? null;
    if (draftAccountId.current === accountId) return;
    draftAccountId.current = accountId;
    for (const timer of draftTimers.current.values()) clearTimeout(timer);
    draftTimers.current.clear();
    loadedDraftIds.current.clear();
    draftsRef.current = {};
    setDrafts({});
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    void Promise.all(conversations.map(async ({ id }) => [id, await getBubblePosition(id)] as const)).then((values) => {
      if (active) setSavedPositions(Object.fromEntries(values.filter((entry): entry is readonly [string, BubblePosition] => entry[1] !== null)));
    });
    return () => { active = false; };
  }, [conversations]);
  useEffect(() => {
    let active = true;
    const accountId = user?.id;
    if (!accountId) return () => { active = false; };
    const pending = conversations.filter(({ id }) => !loadedDraftIds.current.has(id));
    pending.forEach(({ id }) => loadedDraftIds.current.add(id));
    void Promise.all(pending.map(async ({ id }) => [id, await getBubbleDraft(accountId, id).catch(() => "")] as const)).then((values) => {
      if (!active) return;
      const merged = { ...draftsRef.current };
      for (const [id, value] of values) if (!(id in merged) && value) merged[id] = value;
      draftsRef.current = merged;
      setDrafts(merged);
    });
    return () => { active = false; };
  }, [conversations, user?.id]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  if (conversations.length === 0) return null;

  return (
    <>
      {conversations.slice(0, 4).map((conversation, index) => (
        <DraggableBubble
          key={conversation.id}
          conversation={conversation}
          initial={savedPositions[conversation.id] ? {
            x: Math.max(12, Math.min(Math.max(12, width - 66), savedPositions[conversation.id].x)),
            y: Math.max(insets.top + 8, Math.min(height - insets.bottom - 72, savedPositions[conversation.id].y)),
          } : { x: Math.max(12, initial.x - (index % 2) * 8), y: Math.max(insets.top + 66, initial.y - index * 64) }}
          bounds={{ width, height, top: insets.top + 8, bottom: height - insets.bottom - 72 }}
          showUnreadCount={showUnreadCount}
          reduceMotion={reduceMotion}
          onPress={() => setExpandedId(conversation.id)}
          onDismiss={() => onDismiss(conversation.id)}
          onPositionChange={(position) => { setSavedPositions((current) => ({ ...current, [conversation.id]: position })); void saveBubblePosition(conversation.id, position); }}
        />
      ))}
      <Modal visible={activeConversation !== null} animationType={reduceMotion ? "none" : "slide"} transparent statusBarTranslucent onRequestClose={() => setExpandedId(null)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, backgroundColor: colors.scrim }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Collapse conversation" onPress={() => setExpandedId(null)} style={StyleSheet.absoluteFill} />
          {activeConversation ? (
            <View style={[styles.expanded, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 4 }]}>
              <View style={[styles.expandedActions, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <Text style={[styles.expandedLabel, { color: colors.text }]} numberOfLines={1}>{conversationDisplayName(activeConversation)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Open full conversation" onPress={() => { onOpenFull(activeConversation); setExpandedId(null); }} style={styles.actionButton}><Text style={[styles.actionText, { color: colors.brand }]}>Open chat</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Close expanded conversation" onPress={() => setExpandedId(null)} hitSlop={8} style={styles.actionButton}><X size={18} color={colors.muted} /></Pressable>
              </View>
              {conversations.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.conversationSwitcher, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {conversations.map((conversation) => {
                  const name = conversationDisplayName(conversation);
                  const avatarUrl = conversationAvatarUrl(conversation);
                  const selected = conversation.id === activeConversation.id;
                  return <Pressable key={conversation.id} accessibilityRole="button" accessibilityLabel={`Switch to ${name} conversation`} accessibilityState={{ selected }} onPress={() => setExpandedId(conversation.id)} style={[styles.conversationSwitch, selected && { borderColor: colors.brand }]}>
                    {avatarUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: avatarUrl }} style={styles.switchAvatar} /> : <View style={[styles.switchAvatar, styles.switchFallback, { backgroundColor: colors.brandTint }]}><Text style={[styles.switchInitial, { color: colors.brand }]}>{name.slice(0, 1).toUpperCase()}</Text></View>}
                    {showUnreadCount && conversation.unread > 0 ? <View style={[styles.switchUnread, { backgroundColor: colors.brand }]}><Text style={[styles.switchUnreadText, { color: colors.onBrand }]}>{conversation.unread > 99 ? "99+" : conversation.unread}</Text></View> : null}
                  </Pressable>;
                })}
              </ScrollView> : null}
              <ConversationScreen
                key={activeConversation.id}
                conversation={activeConversation}
                compact
                draftValue={drafts[activeConversation.id] ?? ""}
                onDraftChange={(text) => {
                  const conversationId = activeConversation.id;
                  draftsRef.current = { ...draftsRef.current, [conversationId]: text };
                  setDrafts((current) => updateConversationDraft(current, conversationId, text));
                  const previousTimer = draftTimers.current.get(conversationId);
                  if (previousTimer) clearTimeout(previousTimer);
                  if (user?.id) draftTimers.current.set(conversationId, setTimeout(() => {
                    draftTimers.current.delete(conversationId);
                    void saveBubbleDraft(user.id, conversationId, text).catch(() => undefined);
                  }, 250));
                }}
                onClose={() => setExpandedId(null)}
                onOpenFull={() => { onOpenFull(activeConversation); setExpandedId(null); }}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function DraggableBubble({ conversation, initial, bounds, showUnreadCount, reduceMotion, onPress, onDismiss, onPositionChange }: {
  readonly conversation: ConversationSummary;
  readonly initial: BubblePosition;
  readonly bounds: { readonly width: number; readonly height: number; readonly top: number; readonly bottom: number };
  readonly showUnreadCount: boolean;
  readonly reduceMotion: boolean;
  readonly onPress: () => void;
  readonly onDismiss: () => void;
  readonly onPositionChange: (position: BubblePosition) => void;
}) {
  const colors = useMessengerColors();
  const point = useRef(new Animated.ValueXY(initial)).current;
  const origin = useRef(initial);
  useEffect(() => { origin.current = initial; point.setValue(initial); }, [initial.x, initial.y, point]);
  const avatarUrl = conversationAvatarUrl(conversation);
  const name = conversationDisplayName(conversation);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => { point.setOffset(origin.current); point.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: Animated.event([null, { dx: point.x, dy: point.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_event, gesture) => {
      point.flattenOffset();
      const current = { x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy };
      if (gesture.dy > 72 && current.y > bounds.bottom - 100) { onDismiss(); return; }
      const next = { x: current.x < bounds.width / 2 ? 12 : Math.max(12, bounds.width - 66), y: Math.max(bounds.top, Math.min(bounds.bottom, current.y)) };
      origin.current = next;
      onPositionChange(next);
      if (reduceMotion) point.setValue(next);
      else Animated.spring(point, { toValue: next, useNativeDriver: false, speed: 20, bounciness: 5 }).start();
    },
  }), [bounds.bottom, bounds.top, bounds.width, onDismiss, onPositionChange, point, reduceMotion]);

  return (
    <Animated.View {...responder.panHandlers} style={[styles.bubblePosition, { transform: [{ translateX: point.x }, { translateY: point.y }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} conversation${conversation.unread > 0 ? `, ${conversation.unread} unread` : ""}`}
        accessibilityActions={[{ name: "dismiss", label: `Dismiss ${name} chat bubble` }]}
        onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === "dismiss") onDismiss(); }}
        onPress={onPress}
        style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {avatarUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.brandTint }]}><Text style={[styles.initial, { color: colors.brand }]}>{name.slice(0, 1).toUpperCase()}</Text></View>}
        {showUnreadCount && conversation.unread > 0 ? <View style={[styles.unread, { backgroundColor: colors.brand }]}><Text style={[styles.unreadText, { color: colors.onBrand }]}>{conversation.unread > 99 ? "99+" : conversation.unread}</Text></View> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubblePosition: { position: "absolute", left: 0, top: 0, zIndex: 20, width: 56, height: 56 },
  bubble: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  initial: { fontSize: 20, fontWeight: "700" },
  unread: { position: "absolute", top: -3, right: -5, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FFFFFF" },
  unreadText: { fontSize: 9, fontWeight: "700" },
  modalRoot: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  expanded: { width: "100%", maxWidth: 560, height: "78%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  expandedActions: { minHeight: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  expandedLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  conversationSwitcher: { minHeight: 48, alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  conversationSwitch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  switchAvatar: { width: 30, height: 30, borderRadius: 15 },
  switchFallback: { alignItems: "center", justifyContent: "center" },
  switchInitial: { fontSize: 13, fontWeight: "700" },
  switchUnread: { position: "absolute", top: -3, right: -5, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  switchUnreadText: { fontSize: 8, fontWeight: "700" },
  actionButton: { minWidth: 34, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  actionText: { fontSize: 12, fontWeight: "700" },
});
