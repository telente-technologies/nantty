import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageComposerBar } from "@/components/chat/messageComposerBar";
import { DotsThreeVertical24Icon, SpeakerHigh24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { ClipLookOverlay, isClipLookId } from "@/components/create/clip/clipLook.constant";
import { useStoryAutoAdvance } from "@/components/story/storyAutoAdvance.hook";
import { SponsoredStoryPage } from "@/components/story/sponsoredStoryPage";
import { StoryOptionsSheet } from "@/components/story/storyOptionsSheet";
import { StoryProgressBar } from "@/components/story/storyProgressBar";
import { openTrustedWebPage } from "@/components/links/openLink.util";
import { Avatar } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/ui/brandLoader";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { storiesService } from "@/services/clips/stories.service";
import { storyAdsService } from "@/services/clips/storyAds.service";
import { showToast } from "@/store/toast.store";
import { isStoryAdSlot, useStoryAdSessionStore } from "@/store/storyAdSession.store";
import { makeThemedStyles, useTheme } from "@/theme";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import type { StoryDecidedAd } from "@/types/social.type";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function StoryScreen({ navigation, route }: MainScreenProps<"Story">) {
  return <StoryViewer key={route.params.userId} navigation={navigation} route={route} />;
}

function StoryViewer({ navigation, route }: MainScreenProps<"Story">) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const openUserProfile = useOpenUserProfile();
  const { width } = useWindowDimensions();
  const [isReplying, setIsReplying] = useState(false);
  const stories = useQuery({ queryKey: ["stories", route.params.userId], queryFn: () => storiesService.fetchStoriesForUser(route.params.userId) });
  const list = stories.data ?? [];
  const storyTray = useQuery({ queryKey: ["story-tray"], queryFn: storiesService.fetchStoryTray });
  const closeStoryViewer = useCallback(() => {
    useStoryAdSessionStore.getState().reset();
    navigation.goBack();
  }, [navigation]);
  const advanceToNextPersonsStories = useCallback(() => {
    const tray = storyTray.data ?? [];
    const currentPosition = tray.findIndex((item) => item.user.id === route.params.userId);
    const ordered = currentPosition >= 0 ? [...tray.slice(currentPosition + 1), ...tray.slice(0, currentPosition)] : tray;
    const next = ordered.find((item) => item.hasUnseen && item.user.id !== route.params.userId)
      ?? ordered.find((item) => item.user.id !== route.params.userId);
    if (next) navigation.replace("Story", { userId: next.user.id });
    else {
      useStoryAdSessionStore.getState().reset();
      navigation.goBack();
    }
  }, [navigation, route.params.userId, storyTray.data]);
  const [videoStoryProgress, setVideoStoryProgress] = useState(0);
  const sessionOffsetRef = useRef(0);
  const listLengthRef = useRef(0);
  if (list.length > 0 && listLengthRef.current === 0) {
    listLengthRef.current = list.length;
    sessionOffsetRef.current = useStoryAdSessionStore.getState().viewedCount;
  }
  const sessionOffset = sessionOffsetRef.current;
  const adsBySlot = useStoryAdSessionStore((s) => s.adsBySlot);
  const requestedSlots = useStoryAdSessionStore((s) => s.requestedSlots);

  useEffect(() => {
    if (list.length === 0) return;
    const session = useStoryAdSessionStore.getState();
    for (let index = 0; index < list.length; index++) {
      const slot = sessionOffset + index + 1;
      if (!isStoryAdSlot(slot) || session.adsBySlot[slot] || session.requestedSlots.includes(slot)) continue;
      session.markSlotRequested(slot);
      const storyId = list[index]?.id ?? "";
      const neighbours = [list[index - 1]?.id, list[index + 1]?.id].filter((id): id is string => !!id);
      storyAdsService
        .decideStoryAd(storyId, slot - session.lastAdViewedAt - 1, neighbours, slot)
        .then((decision) => {
          if (decision.ad) useStoryAdSessionStore.getState().cacheAdForSlot(slot, decision.ad);
        })
        .catch(() => undefined);
    }
  }, [list, sessionOffset, adsBySlot, requestedSlots]);
  const isFirstStoryVideo = list[0]?.media.type === "video";
  const [isActiveStoryVideo, setIsActiveStoryVideo] = useState(isFirstStoryVideo);
  const [adPage, setAdPage] = useState<{ ad: StoryDecidedAd; slot: number } | null>(null);
  const shownAdSlots = useRef(new Set<number>());
  const { activeIndex, progress, goToNextStory: advanceStoryIndex, goToPreviousStory: rewindStoryIndex } = useStoryAutoAdvance(
    list.length,
    isReplying || isOptionsOpen || isActiveStoryVideo || adPage !== null,
    advanceToNextPersonsStories,
  );
  const goToNextPage = useCallback(() => {
    if (adPage) {
      setAdPage(null);
      advanceStoryIndex();
      return;
    }
    const slot = sessionOffsetRef.current + activeIndex + 1;
    const ad = useStoryAdSessionStore.getState().adsBySlot[slot];
    if (ad && !shownAdSlots.current.has(slot)) {
      shownAdSlots.current.add(slot);
      useStoryAdSessionStore.getState().markAdViewed(slot);
      setAdPage({ ad, slot });
      return;
    }
    advanceStoryIndex();
  }, [adPage, activeIndex, advanceStoryIndex]);
  const goToPreviousPage = useCallback(() => {
    if (adPage) {
      setAdPage(null);
      return;
    }
    rewindStoryIndex();
  }, [adPage, rewindStoryIndex]);
  const story = adPage ? undefined : list[Math.min(activeIndex, Math.max(0, list.length - 1))];

  const openAdDestination = useCallback((ad: StoryDecidedAd) => {
    const destination = ad.creative.destination;
    if (destination.type === "url" && destination.url) openTrustedWebPage(destination.url);
    else if (destination.type === "product" && destination.targetId) navigation.navigate("ProductDetail", { productId: destination.targetId });
    else if (destination.type === "store" && destination.targetId) navigation.navigate("Store", { storeId: destination.targetId });
    else if (destination.type === "post" && destination.targetId) navigation.navigate("PostDetail", { postId: destination.targetId });
    else if (destination.type === "profile" && destination.targetId) openUserProfile(destination.targetId);
    else showToast("This link opens in the Zudomart app");
  }, [navigation, openUserProfile]);

  useEffect(() => {
    setIsActiveStoryVideo(story?.media.type === "video");
    setVideoStoryProgress(0);
    if (story) useStoryAdSessionStore.getState().recordStoryViewed();
  }, [story]);

  useEffect(() => {
    if (story && !story.seen) storiesService.markStoryAsSeen(story.id).catch(() => undefined);
  }, [story]);

  const dragDownToClose = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) closeStoryViewer();
    },
  });

  const sendReply = (text: string) => {
    setIsReplying(false);
    if (!story) return;
    const storyId = story.id;
    const authorId = story.author.id;
    requireAuthThen(() =>
      storiesService
        .replyToStory(storyId, authorId, text)
        .then(() => showToast("Reply sent"))
        .catch((error: unknown) => showToast(readChatCryptoErrorMessage(error) ?? "Reply not sent. Try again.")),
    null, "reply to stories");
  };

  if (stories.isPending || stories.isError || list.length === 0) {
  if (adPage) {
    return (
      <View style={styles.root}>
        <SponsoredStoryPage ad={adPage.ad} onFinished={goToNextPage} onOpenDestination={openAdDestination} />
      </View>
    );
  }

  return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        {stories.isPending ? (
          <BrandLoader size="md" accessibilityLabel="Loading stories" />
        ) : stories.isError ? (
          <ErrorState error={stories.error} message="Couldn't load stories." onRetry={() => stories.refetch()} retrying={stories.isRefetching} />
        ) : (
          <EmptyState title="No stories right now" body="Stories disappear after 24 hours." actionLabel="Close" onAction={closeStoryViewer} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <StoryProgressBar
        count={Math.max(list.length, 1)}
        activeIndex={activeIndex}
        progress={isActiveStoryVideo ? videoStoryProgress : progress}
      />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={story ? `${story.author.name}'s profile` : "Profile"}
          onPress={() => story && openUserProfile(story.author.id)}
          style={styles.author}
        >
          <Avatar uri={story?.author.avatarUrl} size={32} />
          <View style={styles.nameRow}>
            <Text size={typeScale.md} weight={500} lineHeight={16.8}>
              {story?.author.name ?? ""}
            </Text>
            <View style={styles.dot} />
            <Text size={typeScale.md} weight={500} lineHeight={16.8} color={colors.textMuted}>
              {story ? formatTimeSincePosted(story.createdAt) : ""}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {story?.author.live ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${story.author.name} is live, open livestream`}
              onPress={() => navigation.replace("Live", { liveId: story.author.live!.liveId })}
              style={styles.livePill}
            >
              <View style={styles.liveDot} />
              <Text size={typeScale.xs} weight={700} lineHeight={14} color={colors.white}>
                LIVE · Watch
              </Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Story options" onPress={() => setIsOptionsOpen(true)} style={styles.iconButton}>
            <DotsThreeVertical24Icon />
          </Pressable>
        </View>
      </View>
      <View style={styles.media} {...dragDownToClose.panHandlers}>
        {story?.sound ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sound: ${story.sound.title}. Open sound`}
            onPress={() => navigation.navigate("Sound", { soundId: story.sound!.id })}
            style={styles.soundPill}
          >
            <SpeakerHigh24Icon size={14} color={colors.white} />
            <Text size={12} weight={600} lineHeight={16} color={colors.white} numberOfLines={1} style={styles.soundText}>
              {story.sound.title}{story.sound.owner ? ` · @${story.sound.owner.username}` : ""}
            </Text>
          </Pressable>
        ) : null}
        <ClipLookOverlay look={isClipLookId(story?.look) ? story.look : "none"} />
        {story?.media.type === "video" ? (
          <ClipVideoPlayer
            key={story.id}
            media={story.media}
            isActive={!isReplying && !isOptionsOpen}
            isMuted={Platform.OS === "web"}
            loop={false}
            style={StyleSheet.absoluteFill}
            onPlaybackProgress={({ currentSeconds, durationSeconds }) =>
              setVideoStoryProgress(durationSeconds > 0 ? Math.min(currentSeconds / durationSeconds, 1) : 0)
            }
            onPlaybackFinished={goToNextPage}
          />
        ) : story?.media.url ? (
          <Image source={{ uri: story.media.url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          onPress={goToPreviousPage}
          style={[styles.tapZone, { left: 0, width: width * 0.3 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          onPress={goToNextPage}
          style={[styles.tapZone, { right: 0, width: width * 0.7 }]}
        />
      </View>
      <View onTouchStart={() => setIsReplying(true)}>
        <MessageComposerBar
          plusOnRight
          onSend={sendReply}
        />
      </View>
      <StoryOptionsSheet
        story={story}
        visible={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        onOpenProfile={openUserProfile}
        onOpenAnalytics={(storyId) => {
          setIsOptionsOpen(false);
          navigation.navigate("StoryAnalytics", { storyId });
        }}
        onReportClosed={() => setIsOptionsOpen(false)}
        onDeleted={() => {
          if (list.length === 0) closeStoryViewer();
        }}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: "center", justifyContent: "center" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  header: { marginTop: spacing[1], height: 44, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  livePill: { flexDirection: "row", alignItems: "center", gap: spacing[1], minHeight: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.live },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.avatar },
  media: { flex: 1, marginTop: spacing[3] },
  soundPill: { position: "absolute", left: 12, bottom: 12, zIndex: 2, maxWidth: "70%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)" },
  soundText: { flexShrink: 1 },
  tapZone: { position: "absolute", top: 0, bottom: 0 },
}));
