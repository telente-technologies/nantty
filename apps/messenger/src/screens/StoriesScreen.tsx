import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageStyle } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { ArrowLeft, ArrowRight, BookOpenText, CaretLeft, CaretRight, ImageSquare, PaperPlaneRight, WarningCircle, X } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/apiClient";
import { messengerStoriesService, type MessengerStory, type MessengerStoryTrayItem } from "../api/messengerStories.service";
import { publishMessengerPhotoStory } from "../api/messengerStoryPublish.service";
import { sendEncryptedStoryReply } from "../api/messengerChat.service";
import { StoryVideoPlayer } from "./StoryVideoPlayer";
import { useMessengerColors } from "../ui/useMessengerColors";
import { StatePanel } from "../ui/StatePanel";
import { ScreenFrame } from "../ui/ScreenFrame";

type LoadState = "loading" | "ready" | "error";

export function StoriesScreen() {
  const colors = useMessengerColors();
  const { request, user } = useMessengerAuth();
  const [tray, setTray] = useState<readonly MessengerStoryTrayItem[]>([]);
  const [trayState, setTrayState] = useState<LoadState>("loading");
  const [trayError, setTrayError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [stories, setStories] = useState<readonly MessengerStory[]>([]);
  const [storyState, setStoryState] = useState<LoadState>("ready");
  const [storyError, setStoryError] = useState<string | null>(null);
  const [publishingStory, setPublishingStory] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");
  const [failedReply, setFailedReply] = useState<{ readonly text: string; readonly idempotencyKey: string } | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const storyRequestId = useRef(0);
  const activeStory = stories[activeIndex];
  const activeUser = useMemo(() => tray.find(({ user }) => user.id === activeUserId)?.user ?? activeStory?.author ?? null, [activeStory?.author, activeUserId, tray]);

  useEffect(() => {
    setReplyDraft("");
    setFailedReply(null);
    setReplyError(null);
    setReplyNotice(null);
  }, [activeStory?.id]);

  const submitStoryReply = async (retry = false) => {
    if (!activeStory || !user?.id || replySending) return;
    const text = retry && failedReply ? failedReply.text : replyDraft.trim();
    if (!text) return;
    const idempotencyKey = retry && failedReply ? failedReply.idempotencyKey : Crypto.randomUUID();
    setReplySending(true);
    setReplyError(null);
    setReplyNotice(null);
    try {
      await sendEncryptedStoryReply(request, activeStory.author.id, activeStory.id, text, idempotencyKey);
      setReplyDraft("");
      setFailedReply(null);
      setReplyNotice("Reply sent securely.");
    } catch (cause) {
      setFailedReply({ text, idempotencyKey });
      setReplyError(cause instanceof ApiError ? cause.message : "Could not send this reply. Your text stays here; retry when you’re ready.");
    } finally {
      setReplySending(false);
    }
  };

  const loadTray = useCallback(async () => {
    setTrayState("loading");
    setTrayError(null);
    try {
      setTray(await messengerStoriesService.fetchTray(request));
      setTrayState("ready");
    } catch (cause) {
      setTrayError(cause instanceof ApiError ? cause.message : "Could not load Stories.");
      setTrayState("error");
    }
  }, [request]);

  const addPhotoStory = async () => {
    setPublishError(null);
    setPublishNotice(null);
    setPublishingStory(true);
    try {
      let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPublishError("Allow photo library access to choose a Story photo.");
        if (!permission.canAskAgain) Alert.alert("Photo access needed", "Enable photo access in your device settings to add a Story photo.", [{ text: "Not now", style: "cancel" }, { text: "Open settings", onPress: () => { void Linking.openSettings(); } }]);
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.9 });
      if (selection.canceled || !selection.assets[0]) return;
      const image = selection.assets[0];
      await publishMessengerPhotoStory(request, { uri: image.uri, width: image.width, height: image.height });
      await loadTray();
      setPublishNotice("Your photo Story was published.");
    } catch (cause) {
      setPublishError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Could not publish this Story.");
    } finally {
      setPublishingStory(false);
    }
  };

  useEffect(() => { void loadTray(); }, [loadTray]);

  const openUserStories = useCallback(async (userId: string, startAtLast = false) => {
    const requestId = ++storyRequestId.current;
    setActiveUserId(userId);
    setStories([]);
    setActiveIndex(0);
    setStoryState("loading");
    setStoryError(null);
    try {
      const result = await messengerStoriesService.fetchForUser(request, userId);
      if (requestId !== storyRequestId.current) return;
      setStories(result);
      setActiveIndex(startAtLast ? Math.max(0, result.length - 1) : 0);
      setStoryState("ready");
      if (result.length === 0) setStoryError("There are no active Stories for this account.");
    } catch (cause) {
      if (requestId !== storyRequestId.current) return;
      setStoryError(cause instanceof ApiError ? cause.message : "Could not open these Stories.");
      setStoryState("error");
    }
  }, [request]);

  useEffect(() => {
    if (!activeStory || activeStory.seen) return;
    let active = true;
    void messengerStoriesService.markSeen(request, activeStory.id).then(() => {
      if (!active) return;
      setStories((current) => current.map((story) => story.id === activeStory.id ? { ...story, seen: true } : story));
      setTray((current) => current.map((item) => item.user.id === activeStory.author.id ? { ...item, hasUnseen: false } : item));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [activeStory, request]);

  const advance = (direction: -1 | 1) => {
    const nextIndex = activeIndex + direction;
    if (nextIndex >= 0 && nextIndex < stories.length) {
      setActiveIndex(nextIndex);
      return;
    }
    if (direction > 0) {
      const userIndex = tray.findIndex(({ user }) => user.id === activeUserId);
      const nextUser = tray[userIndex + 1];
      if (nextUser) void openUserStories(nextUser.user.id);
      else setActiveUserId(null);
    } else {
      const userIndex = tray.findIndex(({ user }) => user.id === activeUserId);
      const previousUser = tray[userIndex - 1];
      if (previousUser) void openUserStories(previousUser.user.id, true);
    }
  };

  if (activeUserId !== null) {
    return (
      <View style={[styles.viewer, { backgroundColor: colors.background }]}>
        <View style={[styles.viewerHeader, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Stories" onPress={() => { storyRequestId.current += 1; setActiveUserId(null); }} style={styles.iconButton}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          {activeUser ? (
            <View style={styles.author}>
              <View style={[styles.avatar, { backgroundColor: colors.brandTint, borderColor: colors.brand }]}>
                {activeUser.avatarUrl ? <Image source={{ uri: activeUser.avatarUrl }} style={styles.avatarImage as ImageStyle} /> : <Text style={[styles.initial, { color: colors.brand }]}>{activeUser.name.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.authorCopy}>
                <Text numberOfLines={1} style={[styles.authorName, { color: colors.text }]}>{activeUser.name}</Text>
                <Text numberOfLines={1} style={[styles.username, { color: colors.muted }]}>@{activeUser.username}</Text>
              </View>
            </View>
          ) : <View style={styles.author} />}
          <Pressable accessibilityRole="button" accessibilityLabel="Close Stories" onPress={() => { storyRequestId.current += 1; setActiveUserId(null); }} style={styles.iconButton}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        {storyState === "loading" ? (
          <View style={styles.centerState} accessibilityRole="progressbar" accessibilityLabel="Loading Stories"><ActivityIndicator color={colors.brand} /></View>
        ) : storyState === "error" || !activeStory ? (
          <StatePanel Icon={WarningCircle} title={storyState === "error" ? "Stories unavailable" : "No active Stories"} description={storyError ?? "This account has no active Stories right now."} actionLabel={storyState === "error" ? "Retry" : "Back to Stories"} onAction={() => storyState === "error" ? void openUserStories(activeUserId) : setActiveUserId(null)} tone={storyState === "error" ? "error" : "default"} />
        ) : (
          <View style={styles.storyContent}>
            <View style={styles.progressRow} accessibilityLabel={`Story ${activeIndex + 1} of ${stories.length}`}>
              {stories.map((story, index) => <View key={story.id} style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: index <= activeIndex ? colors.brand : "transparent" }]} /></View>)}
            </View>
            {activeStory.media.status === "processing" ? (
              <View style={styles.centerState}><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.muted }]}>This Story is still processing.</Text></View>
            ) : activeStory.media.type === "video" && activeStory.media.url ? (
              <StoryVideoPlayer key={activeStory.id} url={activeStory.media.url} posterUrl={activeStory.media.posterUrl} authorName={activeStory.author.name} />
            ) : activeStory.media.type === "image" && activeStory.media.url ? (
              <View style={styles.mediaFrame}>
                <Image
                  accessibilityLabel="Photo Story"
                  source={{ uri: activeStory.media.url }}
                  resizeMode="cover"
                  style={styles.media as ImageStyle}
                />
              </View>
            ) : activeStory.media.type === "video" && activeStory.media.posterUrl ? (
              <View style={styles.mediaFrame}>
                <Image accessibilityLabel="Video Story preview" source={{ uri: activeStory.media.posterUrl }} resizeMode="cover" style={styles.media as ImageStyle} />
                <Text style={[styles.videoNotice, { color: colors.onBrand, backgroundColor: colors.scrim }]}>Video is not available to play right now.</Text>
              </View>
            ) : (
              <View style={styles.centerState}><BookOpenText size={30} color={colors.muted} /><Text style={[styles.body, { color: colors.muted }]}>This Story has no viewable media.</Text></View>
            )}
            <View style={styles.storyActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous Story" disabled={activeIndex === 0 && tray.findIndex(({ user }) => user.id === activeUserId) <= 0} onPress={() => advance(-1)} style={[styles.navButton, { borderColor: colors.border }]}>
                <CaretLeft size={20} color={colors.text} /><Text style={[styles.navLabel, { color: colors.text }]}>Previous</Text>
              </Pressable>
              <Text style={[styles.storyCount, { color: colors.muted }]}>{activeIndex + 1} / {stories.length}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next Story" onPress={() => advance(1)} style={[styles.navButton, { backgroundColor: colors.brand }]}>
                <Text style={[styles.navLabel, { color: colors.onBrand }]}>Next</Text><CaretRight size={20} color={colors.onBrand} />
              </Pressable>
            </View>
            {user?.id && user.id !== activeStory.author.id ? (
              <View style={[styles.replyComposer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <TextInput
                  accessibilityLabel={`Reply to ${activeStory.author.name}'s Story`}
                  accessibilityHint="Replies are sent as encrypted Messenger messages."
                  editable={!replySending}
                  multiline
                  maxLength={4000}
                  onChangeText={(value) => { setReplyDraft(value); setFailedReply(null); setReplyError(null); }}
                  onSubmitEditing={() => void submitStoryReply()}
                  placeholder="Reply to this Story…"
                  placeholderTextColor={colors.muted}
                  returnKeyType="send"
                  style={[styles.replyInput, { color: colors.text }]}
                  value={replyDraft}
                />
                {failedReply ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Retry sending Story reply" accessibilityState={{ disabled: replySending, busy: replySending }} disabled={replySending} onPress={() => void submitStoryReply(true)} style={[styles.replySendButton, { borderColor: colors.border }]}>
                    {replySending ? <ActivityIndicator color={colors.brand} size="small" /> : <Text style={[styles.retryLabel, { color: colors.text }]}>Retry</Text>}
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Send encrypted Story reply" accessibilityState={{ disabled: replySending || !replyDraft.trim(), busy: replySending }} disabled={replySending || !replyDraft.trim()} onPress={() => void submitStoryReply()} style={[styles.replySendButton, { backgroundColor: colors.brand }, (replySending || !replyDraft.trim()) && styles.disabledButton]}>
                    {replySending ? <ActivityIndicator color={colors.onBrand} size="small" /> : <PaperPlaneRight size={18} color={colors.onBrand} />}
                  </Pressable>
                )}
              </View>
            ) : null}
            {replyError ? <Text accessibilityRole="alert" style={[styles.replyMessage, { color: colors.danger }]}>{replyError}</Text> : null}
            {replyNotice ? <Text accessibilityRole="status" style={[styles.replyMessage, { color: colors.brand }]}>{replyNotice}</Text> : null}
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenFrame title="Stories" eyebrow="NANTTY MESSENGER" backgroundColor={colors.background}>
      <View style={[styles.storyComposer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.storyComposerCopy}>
          <Text style={[styles.storyComposerTitle, { color: colors.text }]}>Share a photo Story</Text>
          <Text style={[styles.storyComposerHint, { color: colors.muted }]}>Stories use Nantty’s public audience; photos are checked before they appear.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={publishingStory ? "Publishing photo Story" : "Add photo Story"} accessibilityState={{ disabled: publishingStory, busy: publishingStory }} disabled={publishingStory} onPress={() => void addPhotoStory()} style={[styles.addStoryButton, { backgroundColor: colors.brand }, publishingStory && styles.disabledButton]}>
          {publishingStory ? <ActivityIndicator color={colors.onBrand} size="small" /> : <ImageSquare size={18} color={colors.onBrand} />}
          <Text style={[styles.addStoryLabel, { color: colors.onBrand }]}>{publishingStory ? "Publishing…" : "Add photo"}</Text>
        </Pressable>
      </View>
      {publishError ? <Text accessibilityRole="alert" style={[styles.publishMessage, { color: colors.danger }]}>{publishError}</Text> : null}
      {publishNotice ? <Text accessibilityRole="status" style={[styles.publishMessage, { color: colors.brand }]}>{publishNotice}</Text> : null}
      {trayState === "loading" ? (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading Stories"><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.muted }]}>Loading Stories…</Text></View>
      ) : trayState === "error" ? (
        <StatePanel Icon={WarningCircle} title="Stories unavailable" description={trayError ?? "Could not load Stories."} actionLabel="Retry" onAction={() => void loadTray()} tone="error" />
      ) : tray.length === 0 ? (
        <StatePanel Icon={BookOpenText} title="No Stories right now" description="Stories from accounts you follow will appear here. They remain governed by the same privacy and expiry rules as Nantty." />
      ) : (
        <ScrollView contentContainerStyle={styles.tray}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>RECENT STORIES</Text>
          {tray.map(({ user, hasUnseen }) => (
            <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`View ${user.name}'s ${hasUnseen ? "unseen " : ""}Stories`} onPress={() => void openUserStories(user.id)} style={[styles.trayItem, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.brandTint, borderColor: hasUnseen ? colors.brand : colors.border }]}>
                {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage as ImageStyle} /> : <Text style={[styles.initial, { color: colors.brand }]}>{user.name.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.trayCopy}>
                <Text numberOfLines={1} style={[styles.authorName, { color: colors.text }]}>{user.name}</Text>
                <Text numberOfLines={1} style={[styles.username, { color: colors.muted }]}>@{user.username}</Text>
              </View>
              {hasUnseen ? <View style={[styles.unseen, { backgroundColor: colors.brand }]} /> : null}
              <ArrowRight size={19} color={colors.muted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, minWidth: 0 },
  viewerHeader: { minHeight: 62, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  author: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  initial: { fontSize: 18, fontWeight: "700" },
  authorCopy: { flex: 1, minWidth: 0, gap: 2 },
  authorName: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  username: { fontSize: 12, lineHeight: 17 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  storyContent: { flex: 1, padding: 16, gap: 12 },
  progressRow: { flexDirection: "row", gap: 4 },
  progressTrack: { height: 3, flex: 1, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", width: "100%" },
  mediaFrame: { flex: 1, minHeight: 180, overflow: "hidden", borderRadius: 16, backgroundColor: "#111" },
  media: { width: "100%", height: "100%" },
  videoNotice: { position: "absolute", left: 12, right: 12, bottom: 12, padding: 10, borderRadius: 10, fontSize: 12, textAlign: "center" },
  storyActions: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  navButton: { minHeight: 44, minWidth: 104, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  navLabel: { fontSize: 13, fontWeight: "600" },
  storyCount: { fontSize: 12 },
  replyComposer: { minHeight: 48, maxHeight: 112, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingLeft: 14, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  replyInput: { flex: 1, minHeight: 42, maxHeight: 96, paddingVertical: 10, fontSize: 14, lineHeight: 20 },
  replySendButton: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  retryLabel: { fontSize: 11, fontWeight: "600" },
  replyMessage: { fontSize: 12, lineHeight: 17 },
  storyComposer: { minHeight: 78, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  storyComposerCopy: { flex: 1, minWidth: 0, gap: 3 },
  storyComposerTitle: { fontSize: 14, fontWeight: "600" },
  storyComposerHint: { fontSize: 12, lineHeight: 17 },
  addStoryButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  addStoryLabel: { fontSize: 13, fontWeight: "600" },
  disabledButton: { opacity: 0.62 },
  publishMessage: { marginHorizontal: 18, marginBottom: 10, fontSize: 13, lineHeight: 18 },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 10 },
  body: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  tray: { paddingHorizontal: 18, paddingBottom: 20 },
  sectionLabel: { marginTop: 12, marginBottom: 10, fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  trayItem: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  trayCopy: { flex: 1, minWidth: 0, gap: 2 },
  unseen: { width: 8, height: 8, borderRadius: 4 },
});
