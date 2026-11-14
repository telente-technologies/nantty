import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageStyle } from "react-native";
import { ArrowLeft, ArrowRight, BookOpenText, CaretLeft, CaretRight, WarningCircle, X } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/apiClient";
import { messengerStoriesService, type MessengerStory, type MessengerStoryTrayItem } from "../api/messengerStories.service";
import { useMessengerColors } from "../ui/useMessengerColors";
import { StatePanel } from "../ui/StatePanel";
import { ScreenFrame } from "../ui/ScreenFrame";

type LoadState = "loading" | "ready" | "error";

export function StoriesScreen() {
  const colors = useMessengerColors();
  const { request } = useMessengerAuth();
  const [tray, setTray] = useState<readonly MessengerStoryTrayItem[]>([]);
  const [trayState, setTrayState] = useState<LoadState>("loading");
  const [trayError, setTrayError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [stories, setStories] = useState<readonly MessengerStory[]>([]);
  const [storyState, setStoryState] = useState<LoadState>("ready");
  const [storyError, setStoryError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const storyRequestId = useRef(0);
  const activeStory = stories[activeIndex];
  const activeUser = useMemo(() => tray.find(({ user }) => user.id === activeUserId)?.user ?? activeStory?.author ?? null, [activeStory?.author, activeUserId, tray]);

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
            ) : activeStory.media.url || activeStory.media.posterUrl ? (
              <View style={styles.mediaFrame}>
                <Image
                  accessibilityLabel={activeStory.media.type === "video" ? "Video Story preview" : "Photo Story"}
                  source={{ uri: activeStory.media.type === "video" ? activeStory.media.posterUrl ?? activeStory.media.url ?? undefined : activeStory.media.url ?? undefined }}
                  resizeMode="cover"
                  style={styles.media as ImageStyle}
                />
                {activeStory.media.type === "video" ? <Text style={[styles.videoNotice, { color: colors.onBrand, backgroundColor: colors.scrim }]}>Video playback is not available in Messenger yet.</Text> : null}
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
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenFrame title="Stories" eyebrow="NANTTY MESSENGER" backgroundColor={colors.background}>
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
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 10 },
  body: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  tray: { paddingHorizontal: 18, paddingBottom: 20 },
  sectionLabel: { marginTop: 12, marginBottom: 10, fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  trayItem: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  trayCopy: { flex: 1, minWidth: 0, gap: 2 },
  unseen: { width: 8, height: 8, borderRadius: 4 },
});
