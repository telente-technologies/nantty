import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { SpeakerHigh24Icon, ViewProducts24Icon } from "@/components/icons";
import { ClipVideoPlayer, VideoPosterOnly } from "@/components/media/clipVideoPlayer";
import { LandscapeVideoFullScreenModal } from "@/components/media/landscapeVideoFullScreenModal";
import { calculateFeedVideoAspectRatio } from "@/components/media/videoOrientation.util";
import { makeThemedStyles } from "@/theme";
import { claimAudioFocusForVideoPlayback } from "@/services/videoAudio.service";
import { useVideoAudioStore } from "@/store/videoAudio.store";
import type { Media, SaveTarget } from "@/types";

import { MediaLightbox } from "./mediaLightbox";
import { AnimatedPageIndicator } from "./pageIndicator";

export interface MediaPagerProps {
  readonly media: readonly Media[];
  readonly height?: number;
  readonly isVisibleOnScreen?: boolean;
  readonly onPressViewProducts?: () => void;
  readonly saveTarget?: SaveTarget;
  readonly savedAccordingToServer?: boolean;
  readonly overlay?: ReactNode;
}

const MAXIMUM_PAGER_WIDTH = 393;
const DEFAULT_PHOTO_PAGER_HEIGHT = 335;

export function MediaPager({ media, height: requestedHeight, isVisibleOnScreen = true, onPressViewProducts, saveTarget, savedAccordingToServer, overlay }: MediaPagerProps) {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const pageWidth = containerWidth ?? windowWidth;
  const firstMedia = media[0];
  const height =
    requestedHeight ??
    (firstMedia?.type === "video"
      ? Math.round(Math.min(pageWidth, MAXIMUM_PAGER_WIDTH) / calculateFeedVideoAspectRatio(firstMedia))
      : DEFAULT_PHOTO_PAGER_HEIGHT);
  const [fullScreenVideo, setFullScreenVideo] = useState<Media | null>(null);
  const [openedImageIndex, setOpenedImageIndex] = useState<number | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const scrollOffsetX = useRef(new Animated.Value(0)).current;
  const pages: readonly Media[] = media.length > 0 ? media : [{ type: "image", url: null }];
  const imagePages = pages.filter((item) => item.type === "image");
  const isMuted = useVideoAudioStore((state) => state.isMuted);
  const toggleMute = useVideoAudioStore((state) => state.toggleMute);
  const activePageMedia = pages[activePageIndex];
  const isActivePageVideo = activePageMedia?.type === "video";

  useEffect(() => {
    if (!isActivePageVideo || isMuted || !isVisibleOnScreen) return;
    claimAudioFocusForVideoPlayback();
  }, [isActivePageVideo, isMuted, isVisibleOnScreen]);

  const openImageAtPagerIndex = (pagerIndex: number) => {
    const position = pages.slice(0, pagerIndex).filter((item) => item.type === "image").length;
    setOpenedImageIndex(position);
  };

  const updateActivePageFromScrollOffset = (offsetX: number) => {
    scrollOffsetX.setValue(offsetX);
    const nextIndex = Math.round(offsetX / pageWidth);
    if (nextIndex !== activePageIndex) setActivePageIndex(nextIndex);
  };

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0) setContainerWidth((previous) => (previous === nextWidth ? previous : nextWidth));
      }}
    >
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={pages.length > 1}
        bounces={pages.length > 1}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        keyExtractor={(item, index) => item.id ?? `${item.url ?? "empty"}-${index}`}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        onScroll={(event) => updateActivePageFromScrollOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        initialNumToRender={2}
        windowSize={3}
        renderItem={({ item, index }) => (
          <View style={{ width: pageWidth, height }}>
            <MediaPagerPage
              media={item}
              isMuted={isMuted}
              isActive={isVisibleOnScreen && fullScreenVideo === null && index === activePageIndex}
              isNearActive={Math.abs(index - activePageIndex) <= 1}
            />
            {item.type === "video" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play video full screen"
                onPress={() => setFullScreenVideo(item)}
                style={StyleSheet.absoluteFill}
              />
            ) : item.type === "image" && item.url ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open image ${index + 1} full screen`}
                onPress={() => openImageAtPagerIndex(index)}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        )}
      />
      {overlay}
      <View style={styles.overlay} pointerEvents="box-none">
        {pages.length > 1 ? (
          <AnimatedPageIndicator count={pages.length} activeIndex={activePageIndex} scrollOffsetX={scrollOffsetX} pageWidth={pageWidth} />
        ) : (
          <View />
        )}
        <View style={styles.overlayActions}>
          {isActivePageVideo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
              accessibilityState={{ selected: isMuted }}
              hitSlop={10}
              onPress={toggleMute}
              style={isMuted ? styles.mutedSpeaker : undefined}
            >
              <SpeakerHigh24Icon />
            </Pressable>
          ) : null}
          {onPressViewProducts ? (
            <Pressable accessibilityRole="button" accessibilityLabel="View products in this post" hitSlop={10} onPress={onPressViewProducts}>
              <ViewProducts24Icon />
            </Pressable>
          ) : null}
        </View>
      </View>
      <LandscapeVideoFullScreenModal
        media={fullScreenVideo}
        isMuted={isMuted}
        onClose={() => setFullScreenVideo(null)}
        saveTarget={saveTarget}
        savedAccordingToServer={savedAccordingToServer}
      />
      {openedImageIndex !== null ? (
        <MediaLightbox images={imagePages} initialIndex={openedImageIndex} onClose={() => setOpenedImageIndex(null)} />
      ) : null}
    </View>
  );
}

function MediaPagerPage({
  media,
  isMuted,
  isActive,
  isNearActive,
}: {
  media: Media;
  isMuted: boolean;
  isActive: boolean;
  isNearActive: boolean;
}) {
  if (media.type === "video") {
    return isNearActive && isActiveOrPreloadable(media) ? (
      <ClipVideoPlayer media={media} isActive={isActive} isMuted={isMuted} style={StyleSheet.absoluteFill} />
    ) : (
      <VideoPosterOnly media={media} style={StyleSheet.absoluteFill} />
    );
  }
  const imageUrl = media.url ?? media.posterUrl ?? null;
  if (!imageUrl) return null;
  return (
    <Image
      source={{ uri: imageUrl }}
      placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={imageUrl}
      transition={120}
    />
  );
}

const isActiveOrPreloadable = (media: Media) => !!(media.url || media.hlsUrl) && media.status !== "processing" && media.status !== "failed";

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { backgroundColor: colors.media, overflow: "hidden" },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  overlayActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  mutedSpeaker: { opacity: 0.35 },
}));
