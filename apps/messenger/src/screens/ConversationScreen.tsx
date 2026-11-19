import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeft, ChatCircleDots, GearSix, ImageSquare, PaperPlaneRight, Smiley } from "phosphor-react-native";
import * as Crypto from "expo-crypto";
import { ChatControlLedger } from "@nantty/chat-crypto";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMessengerAuth } from "../auth/AuthProvider";
import { conversationAvatarUrl, conversationDisplayName, type ConversationSummary } from "../api/conversations";
import { fetchEncryptedMessagePage, markConversationRead, queueStatusForConversation, sendEncryptedControl, sendEncryptedImage, sendEncryptedText, type MessengerMessage } from "../api/messengerChat.service";
import { clearDecryptedMessengerImages, decryptMessengerImage, uploadEncryptedMessengerImage } from "../api/messengerImageAttachment.service";
import { sendMessengerTypingSignal, subscribeToMessengerConversation } from "../api/messengerRealtime.service";
import { useMessengerColors } from "../ui/useMessengerColors";
import { StatePanel } from "../ui/StatePanel";
import { openAndroidConversationNotificationSettings } from "../api/chatBubblesNative.service";

interface ConversationScreenProps {
  readonly conversation: ConversationSummary;
  readonly compact?: boolean;
  readonly onBack?: () => void;
  readonly onClose?: () => void;
  readonly onOpenFull?: () => void;
  readonly onToggleBubble?: () => void;
  readonly isBubbleActive?: boolean;
  readonly draftValue?: string;
  readonly onDraftChange?: (value: string) => void;
}

export function ConversationScreen({ conversation, compact = false, onBack, onClose, onOpenFull, onToggleBubble, isBubbleActive = false, draftValue, onDraftChange }: ConversationScreenProps) {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const { request, user } = useMessengerAuth();
  const [messages, setMessages] = useState<readonly MessengerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [draft, setDraft] = useState(draftValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState<{ readonly text: string; readonly idempotencyKey: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [sendingReactionTo, setSendingReactionTo] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const listRef = useRef<FlatList<MessengerMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSent = useRef(false);
  const displayName = conversationDisplayName(conversation);
  const controlLedger = useMemo(() => ChatControlLedger.from(messages.flatMap((message) => (
    message.kind === "control" && message.control && message.deliveryStatus !== "failed"
      ? [{ id: message.id, senderId: message.senderId, createdAt: message.createdAt, control: message.control }]
      : []
  ))), [messages]);
  const visibleMessages = useMemo(() => messages.filter((message) => message.kind !== "control"), [messages]);
  const setTyping = useCallback((next: boolean) => {
    if (typingSent.current === next) return;
    typingSent.current = next;
    sendMessengerTypingSignal(conversation.id, next);
  }, [conversation.id]);
  const changeDraft = useCallback((value: string) => {
    setDraft(value);
    onDraftChange?.(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (value.trim().length === 0) {
      setTyping(false);
      typingTimer.current = null;
      return;
    }
    setTyping(true);
    typingTimer.current = setTimeout(() => {
      setTyping(false);
      typingTimer.current = null;
    }, 1_800);
  }, [onDraftChange, setTyping]);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      const page = await fetchEncryptedMessagePage(request, conversation.id);
      const pending = await queueStatusForConversation(conversation.id);
      setMessages((current) => mergeMessages(page.data, pending, ...(refresh ? [current] : [])));
      if (!refresh || nextCursorRef.current === null) {
        nextCursorRef.current = page.nextCursor;
        setNextCursor(page.nextCursor);
      }
      await markConversationRead(request, conversation.id).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this conversation securely.");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, request]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await fetchEncryptedMessagePage(request, conversation.id, nextCursor);
      setMessages((current) => mergeMessages(current, page.data));
      nextCursorRef.current = page.nextCursor;
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setOlderError(cause instanceof Error ? cause.message : "Earlier messages could not be loaded.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversation.id, nextCursor, request]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessengerConversation(request, conversation.id, (event) => {
    if (event.type === "message.created" || event.type === "message.updated") void load(true);
    if (event.type === "typing" && event.conversationId === conversation.id) {
      const typingUser = event.user as { readonly id?: unknown } | undefined;
      setPeerTyping(typingUser?.id !== user?.id && event.isTyping === true);
      if (event.isTyping === false) setPeerTyping(false);
    }
  }), [conversation.id, load, request, user?.id]);
  useEffect(() => {
    if (!peerTyping) return;
    const timer = setTimeout(() => setPeerTyping(false), 6_000);
    return () => clearTimeout(timer);
  }, [peerTyping]);
  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingSent.current) sendMessengerTypingSignal(conversation.id, false);
  }, [conversation.id]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void load(true); });
    return () => subscription.remove();
  }, [load]);

  const send = async (retry = false) => {
    const text = retry ? failedDraft?.text ?? "" : draft.trim();
    if (!text || sending) return;
    const idempotencyKey = retry ? failedDraft?.idempotencyKey : Crypto.randomUUID();
    if (!idempotencyKey) return;
    setTyping(false);
    setSending(true);
    setError(null);
    try {
      const sent = await sendEncryptedText(request, conversation, text, idempotencyKey);
      setMessages((current) => mergeMessages([sent], current));
      if (!retry) {
        setDraft("");
        onDraftChange?.("");
      }
      setFailedDraft(null);
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    } catch (cause) {
      setFailedDraft({ text, idempotencyKey });
      setError(cause instanceof Error ? cause.message : "Message could not be sent. Retry when you’re connected.");
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (message: MessengerMessage, emoji: string) => {
    if (!user?.id || sendingReactionTo) return;
    const remove = controlLedger.myReactions(message.id, user.id).includes(emoji);
    setSendingReactionTo(message.id);
    setError(null);
    try {
      const control = { type: "reaction" as const, targetMessageId: message.id, emoji, remove };
      const sent = await sendEncryptedControl(request, conversation, control, Crypto.randomUUID());
      setMessages((current) => mergeMessages([sent], current));
      setReactingTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reaction could not be sent securely.");
    } finally {
      setSendingReactionTo(null);
    }
  };

  const pickAndSendImage = async () => {
    if (sendingAttachment || sending) return;
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Allow photo access to attach an image to your encrypted chat.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1, exif: false });
      const image = result.canceled ? null : result.assets[0];
      if (!image) return;
      setSendingAttachment(true);
      const uploaded = await uploadEncryptedMessengerImage(request, { uri: image.uri, width: image.width, height: image.height });
      const sent = await sendEncryptedImage(request, conversation, uploaded.mediaId, uploaded.pointer, Crypto.randomUUID());
      setMessages((current) => mergeMessages([sent], current));
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The encrypted image could not be sent.");
    } finally {
      setSendingAttachment(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface, paddingTop: compact ? 8 : Math.max(insets.top, 8) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={compact ? "Collapse conversation" : "Back to conversations"} onPress={compact ? onClose : onBack} style={styles.headerAction}>
          <ArrowLeft size={21} color={colors.text} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: colors.brandTint }]}>
          {conversationAvatarUrl(conversation) ? <Image source={{ uri: conversationAvatarUrl(conversation)! }} style={styles.avatarImage} /> : <Text style={[styles.avatarInitial, { color: colors.brand }]}>{displayName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.titleCopy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{displayName}{conversation.peer.verified ? " ✓" : ""}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {conversation.kind === "business" || conversation.store
              ? "Consented business conversation"
              : conversation.kind === "group" || conversation.kind === "channel"
                ? "Encrypted group conversation"
                : "End-to-end encrypted"}
          </Text>
        </View>
        {compact && onOpenFull ? <Pressable accessibilityRole="button" accessibilityLabel="Open full conversation" onPress={onOpenFull} style={styles.headerAction}><ChatCircleDots size={21} color={colors.text} /></Pressable> : null}
        {!compact && Platform.OS === "android" ? <Pressable accessibilityRole="button" accessibilityLabel="Open Android notification settings for this conversation" onPress={() => { void openAndroidConversationNotificationSettings(user?.id ?? "", conversation.id).then((status) => { if (status !== "opened") Alert.alert("Conversation settings unavailable", status === "channel_not_created" ? "Android creates conversation notification settings after an eligible message notification has arrived." : "Android could not open notification settings for this conversation."); }); }} style={styles.headerAction}><GearSix size={19} color={colors.text} /></Pressable> : null}
        {!compact && onToggleBubble ? <Pressable accessibilityRole="button" accessibilityLabel={isBubbleActive ? "Remove conversation from in-app floating chats" : "Keep conversation in in-app floating chats"} onPress={onToggleBubble} style={styles.headerAction}><ChatCircleDots size={21} color={isBubbleActive ? colors.brand : colors.text} weight={isBubbleActive ? "fill" : "regular"} /></Pressable> : null}
      </View>

      {error && messages.length === 0 ? <StatePanel Icon={ChatCircleDots} title="Conversation unavailable" description={error} actionLabel="Retry" onAction={() => void load()} tone="error" /> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={[styles.loadingText, { color: colors.muted }]}>Unlocking secure messages…</Text></View> : (
        <FlatList
          ref={listRef}
          accessibilityLabel="Encrypted conversation messages"
          inverted
          data={visibleMessages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.messages}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={loadingOlder ? <View style={styles.olderLoading}><ActivityIndicator color={colors.brand} size="small" /><Text style={[styles.loadingText, { color: colors.muted }]}>Loading earlier messages…</Text></View> : undefined}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>Messages in this conversation are protected with Nantty encryption.</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            const reactions = controlLedger.reactions(item.id, user?.id ?? "");
            return <View style={[styles.messageRow, mine && styles.messageRowMine]}>
              <View style={styles.messageColumn}>
                <View style={[styles.messageBubble, { backgroundColor: mine ? colors.brand : colors.surface, borderColor: colors.border }]}>
                  {item.kind === "image" && item.attachment ? item.media?.url ? <EncryptedMessageImage mediaId={item.media.id} url={item.media.url} pointer={item.attachment} /> : item.attachment.thumbnail ? <Image accessibilityLabel="Encrypted photo" source={{ uri: `data:image/jpeg;base64,${item.attachment.thumbnail}` }} resizeMode="cover" style={styles.imageMessage} /> : <Text style={[styles.messageText, { color: mine ? colors.onBrand : colors.text }]}>Encrypted photo</Text> : <Text selectable style={[styles.messageText, { color: mine ? colors.onBrand : colors.text }]}>{item.decryptionNotice || item.text || "Message could not be displayed securely."}</Text>}
                  <Text style={[styles.messageMeta, { color: mine ? colors.onBrand : colors.subtle }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{mine ? (item.deliveryStatus === "sending" ? " · Sending" : item.deliveryStatus === "failed" ? " · Failed" : item.readAt ? " · Read" : " · Sent") : ""}</Text>
                </View>
                {reactions.length > 0 ? <View style={styles.reactionList}>{reactions.map((reaction) => <Pressable key={reaction.emoji} accessibilityRole="button" accessibilityLabel={`${reaction.emoji}, ${reaction.count} reactions${reaction.reactedByMe ? ", remove your reaction" : ", add your reaction"}`} onPress={() => void toggleReaction(item, reaction.emoji)} style={[styles.reactionChip, { backgroundColor: colors.surface, borderColor: reaction.reactedByMe ? colors.brand : colors.border }]}><Text style={styles.reactionEmoji}>{reaction.emoji}</Text><Text style={[styles.reactionCount, { color: colors.text }]}>{reaction.count}</Text></Pressable>)}</View> : null}
                {reactingTo === item.id ? <View style={[styles.reactionPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>{["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`React with ${emoji}`} accessibilityState={{ disabled: sendingReactionTo === item.id }} disabled={sendingReactionTo === item.id} onPress={() => void toggleReaction(item, emoji)} style={styles.reactionOption}><Text style={styles.reactionEmoji}>{emoji}</Text></Pressable>)}</View> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`React to message from ${mine ? "you" : displayName}`} accessibilityState={{ disabled: sendingReactionTo === item.id, expanded: reactingTo === item.id }} disabled={sendingReactionTo === item.id} onPress={() => setReactingTo((current) => current === item.id ? null : item.id)} style={styles.reactionButton}><Smiley size={18} color={colors.muted} /></Pressable>
            </View>;
          }}
        />
      )}

      {error && messages.length > 0 ? <View style={[styles.errorLine, { borderTopColor: colors.border }]}><Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>{failedDraft ? <Pressable accessibilityRole="button" disabled={sending} onPress={() => void send(true)}><Text style={[styles.retry, { color: colors.brand }]}>{sending ? "Retrying…" : "Retry"}</Text></Pressable> : null}</View> : null}
      {olderError ? <View style={[styles.errorLine, { borderTopColor: colors.border }]}><Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: colors.danger }]}>{olderError}</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: loadingOlder }} disabled={loadingOlder} onPress={() => void loadOlder()}><Text style={[styles.retry, { color: colors.brand }]}>{loadingOlder ? "Retrying…" : "Retry earlier messages"}</Text></Pressable></View> : null}
      {peerTyping ? <Text accessibilityLiveRegion="polite" style={[styles.typing, { color: colors.muted }]}>Typing…</Text> : null}
      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: compact ? 8 : Math.max(insets.bottom, 8) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Attach an encrypted image" accessibilityState={{ disabled: sending || sendingAttachment, busy: sendingAttachment }} disabled={sending || sendingAttachment} onPress={() => void pickAndSendImage()} style={styles.attachmentButton}>{sendingAttachment ? <ActivityIndicator color={colors.brand} size="small" /> : <ImageSquare size={20} color={colors.muted} />}</Pressable>
        <TextInput accessibilityLabel="Write an encrypted message" editable={!sending} multiline maxLength={4000} onChangeText={changeDraft} onBlur={() => setTyping(false)} onSubmitEditing={() => void send()} placeholder="Message" placeholderTextColor={colors.subtle} returnKeyType="send" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={draft} />
        <Pressable accessibilityRole="button" accessibilityLabel={sending ? "Sending message" : "Send encrypted message"} accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }} disabled={!draft.trim() || sending} onPress={() => void send()} style={[styles.sendButton, { backgroundColor: colors.brand }, (!draft.trim() || sending) && styles.sendDisabled]}>
          {sending ? <ActivityIndicator color={colors.onBrand} size="small" /> : <PaperPlaneRight size={19} color={colors.onBrand} weight="fill" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function EncryptedMessageImage({ mediaId, url, pointer }: { readonly mediaId: string; readonly url: string; readonly pointer: NonNullable<MessengerMessage["attachment"]> }) {
  const colors = useMessengerColors();
  const [uri, setUri] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const isForeground = state === "active";
      setForeground(isForeground);
      if (!isForeground) {
        setUri(null);
        clearDecryptedMessengerImages();
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!foreground) return;
    let active = true;
    setUri(null);
    void decryptMessengerImage(mediaId, url, pointer).then((value) => { if (active) setUri(value); }).catch(() => { if (active) setUri(null); });
    return () => { active = false; };
  }, [foreground, mediaId, pointer, url]);
  const ratio = (pointer.width ?? 4) / Math.max(1, pointer.height ?? 3);
  const height = Math.max(112, Math.min(240, 220 / Math.max(0.4, Math.min(2.5, ratio))));
  return uri ? <Image accessibilityLabel="End-to-end encrypted photo" source={{ uri }} resizeMode="cover" style={[styles.imageMessage, { height }]} /> : <View accessibilityLabel="Decrypting encrypted photo" style={[styles.imageLoading, { height, backgroundColor: colors.background }]}><ActivityIndicator size="small" color={colors.brand} /></View>;
}

function mergeMessages(...batches: readonly (readonly MessengerMessage[])[]): readonly MessengerMessage[] {
  const unique = new Map<string, MessengerMessage>();
  for (const message of batches.flat()) unique.set(message.id, message);
  return [...unique.values()].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  header: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headerAction: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 17, fontWeight: "700" },
  titleCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  subtitle: { fontSize: 11, lineHeight: 15 },
  messages: { flexGrow: 1, justifyContent: "flex-end", gap: 8, padding: 14 },
  messageRow: { flexDirection: "row", justifyContent: "flex-start" },
  messageRowMine: { justifyContent: "flex-end" },
  messageColumn: { maxWidth: "88%" },
  messageBubble: { maxWidth: "100%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageMeta: { alignSelf: "flex-end", fontSize: 10, lineHeight: 14 },
  imageMessage: { width: 220, height: 180, borderRadius: 11, backgroundColor: "#00000010" },
  imageLoading: { width: 220, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  reactionButton: { width: 34, minHeight: 38, alignItems: "center", justifyContent: "center" },
  reactionList: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: -4, paddingHorizontal: 4 },
  reactionChip: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13 },
  reactionCount: { fontSize: 10, fontWeight: "600" },
  reactionPicker: { alignSelf: "flex-start", flexDirection: "row", gap: 3, marginTop: 5, paddingHorizontal: 5, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20 },
  reactionOption: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  reactionEmoji: { fontSize: 17 },
  empty: { alignSelf: "center", maxWidth: 270, paddingVertical: 30, textAlign: "center", fontSize: 13, lineHeight: 19 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  olderLoading: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  attachmentButton: { width: 34, minHeight: 42, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, maxHeight: 112, minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.45 },
  errorLine: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth },
  errorText: { flex: 1, fontSize: 12 },
  typing: { paddingHorizontal: 15, paddingTop: 6, fontSize: 11 },
  retry: { fontSize: 12, fontWeight: "700" },
});
