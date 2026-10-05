import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageComposerBar } from "@/components/chat/messageComposerBar";
import { DotsThreeVertical24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { useStoryAutoAdvance } from "@/components/story/storyAutoAdvance.hook";
import { StoryOptionsSheet } from "@/components/story/storyOptionsSheet";
import { StoryProgressBar } from "@/components/story/storyProgressBar";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { storiesService } from "@/services/stories.service";
import { showToast } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function StoryScreen({ navigation, route }: MainScreenProps<"Story">) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const openUserProfile = useOpenUserProfile();
  const { width } = useWindowDimensions();
  const [isReplying, setIsReplying] = useState(false);
  const stories = useQuery({ queryKey: ["stories", route.params.userId], queryFn: () => storiesService.fetchStoriesForUser(route.params.userId) });
  const list = stories.data ?? [];
  const closeStoryViewer = useCallback(() => navigation.goBack(), [navigation]);
  const [videoStoryProgress, setVideoStoryProgress] = useState(0);
  const isFirstStoryVideo = list[0]?.media.type === "video";
  const [isActiveStoryVideo, setIsActiveStoryVideo] = useState(isFirstStoryVideo);
  const { activeIndex, progress, goToNextStory, goToPreviousStory } = useStoryAutoAdvance(
    list.length,
    isReplying || isOptionsOpen || isActiveStoryVideo,
    closeStoryViewer,
  );
  const story = list[activeIndex];

  useEffect(() => {
    setIsActiveStoryVideo(story?.media.type === "video");
    setVideoStoryProgress(0);
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
    requireAuthThen(() =>
      storiesService
        .replyToStory(storyId, text)
        .then(() => showToast("Reply sent"))
        .catch(() => showToast("Reply not sent. Try again.")),
    null, "reply to stories");
  };

  if (stories.isPending || stories.isError || list.length === 0) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        {stories.isPending ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading stories" />
        ) : stories.isError ? (
          <ErrorState message="Couldn't load stories." onRetry={() => stories.refetch()} retrying={stories.isRefetching} />
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
            onPlaybackFinished={goToNextStory}
          />
        ) : story?.media.url ? (
          <Image source={{ uri: story.media.url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          onPress={goToPreviousStory}
          style={[styles.tapZone, { left: 0, width: width * 0.3 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          onPress={goToNextStory}
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
        onReportClosed={() => setIsOptionsOpen(false)}
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
  tapZone: { position: "absolute", top: 0, bottom: 0 },
}));
