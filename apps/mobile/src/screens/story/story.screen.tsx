import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageComposerBar } from "@/components/chat/messageComposerBar";
import { DotsThreeVertical24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { useStoryAutoAdvance } from "@/components/story/storyAutoAdvance.hook";
import { StoryProgressBar } from "@/components/story/storyProgressBar";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { storiesService } from "@/services/stories.service";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

export function StoryScreen({ navigation, route }: MainScreenProps<"Story">) {
  const insets = useSafeAreaInsets();
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
    isReplying || isActiveStoryVideo,
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StoryProgressBar
        count={Math.max(list.length, 1)}
        activeIndex={activeIndex}
        progress={isActiveStoryVideo ? videoStoryProgress : progress}
      />
      <View style={styles.header}>
        <View style={styles.author}>
          <Avatar uri={story?.author.avatarUrl} size={32} />
          <View style={styles.nameRow}>
            <Text size={14} weight={500} lineHeight={16.8}>
              {story?.author.name ?? ""}
            </Text>
            <View style={styles.dot} />
            <Text size={14} weight={500} lineHeight={16.8} color={colors.textMuted}>
              {story ? formatTimeSincePosted(story.createdAt) : ""}
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Story options" hitSlop={10}>
          <DotsThreeVertical24Icon />
        </Pressable>
      </View>
      <View style={styles.media} {...dragDownToClose.panHandlers}>
        {story?.media.type === "video" ? (
          <ClipVideoPlayer
            key={story.id}
            media={story.media}
            isActive={!isReplying}
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
          onSend={(text) => {
            if (story) storiesService.replyToStory(story.id, text).catch(() => undefined);
            setIsReplying(false);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { marginTop: 4, height: 32, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.avatar },
  media: { flex: 1, marginTop: 12 },
  tapZone: { position: "absolute", top: 0, bottom: 0 },
});
