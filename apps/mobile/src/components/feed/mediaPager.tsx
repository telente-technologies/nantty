import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, FlatList, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from "react-native";

import { SpeakerHigh24Icon, ViewProducts24Icon } from "@/components/icons";
import { VideoPosterOnly, type VideoPlaybackController } from "@/components/media/clipVideoPlayer";
import { LandscapeVideoFullScreenModal } from "@/components/media/landscapeVideoFullScreenModal";
import { calculateFeedVideoAspectRatio } from "@/components/media/videoOrientation.util";
import { makeThemedStyles } from "@/theme";
import { claimAudioFocusForVideoPlayback } from "@/services/clips/videoAudio.service";
import { useVideoAudioStore } from "@/store/videoAudio.store";
import type { Media, SaveTarget } from "@/types";

import { FeedVideoPage } from "./feedVideoPage";
import { MediaLightbox } from "./mediaLightbox";
import type { MediaLightboxPostActionsProps } from "./mediaLightboxPostActions";
import { AnimatedPageIndicator } from "./pageIndicator";
import { ClipLookOverlay, isClipLookId } from "@/components/create/clip/clipLook.constant";
import { VideoWatermark } from "@/components/media/videoWatermark";
import { horizontalScrollGestureGuardProps } from "@/components/home/horizontalScrollGestureGuard.util";

export interface MediaPagerProps {
  readonly media: readonly Media[];
  readonly height?: number;
  readonly isVisibleOnScreen?: boolean;
  readonly onPressViewProducts?: () => void;
  readonly saveTarget?: SaveTarget;
  readonly savedAccordingToServer?: boolean;
  readonly overlay?: ReactNode;
  readonly onDownloadMedia?: (media: Media) => void;
  readonly look?: string | null;
  readonly watermarkHandle?: string | null;
  readonly postActions?: MediaLightboxPostActionsProps;
}

const MAXIMUM_PAGER_WIDTH = 393;
const DEFAULT_PHOTO_PAGER_HEIGHT = 335;

export function MediaPager({ media, height: requestedHeight, isVisibleOnScreen = true, onPressViewProducts, saveTarget, savedAccordingToServer, overlay, onDownloadMedia, look, watermarkHandle, postActions }: MediaPagerProps) {
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
  const [scrollOffsetX] = useState(() => new Animated.Value(0));
  const pages: readonly Media[] = media.length > 0 ? media : [{ type: "image", url: null }];
  const imagePages = pages.filter((item) => item.type === "image");
  const isMuted = useVideoAudioStore((state) => state.isMuted);
  const toggleMute = useVideoAudioStore((state) => state.toggleMute);
  const activeVideoController = useRef<VideoPlaybackController | null>(null);
  const activeVideoPositionSeconds = useRef(0);
  const [fullScreenStartSeconds, setFullScreenStartSeconds] = useState(0);
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
  const openImageFromFeed = (event: GestureResponderEvent, pagerIndex: number) => {
    event.stopPropagation();
    openImageAtPagerIndex(pagerIndex);
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
        {...horizontalScrollGestureGuardProps}
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
        renderItem={({ item, index }) =>
          item.type === "video" ? (
            <View style={{ width: pageWidth, height }}>
              <FeedVideoPage
                media={item}
                isMuted={isMuted}
                isActive={isVisibleOnScreen && fullScreenVideo === null && index === activePageIndex}
                shouldMountPlayer={Math.abs(index - activePageIndex) <= 1 && isActiveOrPreloadable(item)}
                controllerRef={index === activePageIndex ? activeVideoController : undefined}
                onPlaybackProgress={(progress) => {
                  activeVideoPositionSeconds.current = progress.currentSeconds;
                }}
              >
                <ClipLookOverlay look={isClipLookId(look) ? look : "none"} />
                {watermarkHandle ? <VideoWatermark handle={watermarkHandle} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Play video full screen"
                  onPress={(event) => {
                    event.stopPropagation();
                    setFullScreenStartSeconds(activeVideoPositionSeconds.current);
                    setFullScreenVideo(item);
                  }}
                  style={StyleSheet.absoluteFill}
                />
              </FeedVideoPage>
            </View>
          ) : (
          <View style={{ width: pageWidth, height }}>
            <MediaPagerPage media={item} />
            <ClipLookOverlay look={isClipLookId(look) ? look : "none"} />
            {item.type === "image" && item.url ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open image ${index + 1} full screen`}
                onPress={(event) => openImageFromFeed(event, index)}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
          )
        }
      />
      {overlay}
      <View style={[styles.overlay, isActivePageVideo ? styles.overlayAboveSeekBar : null]} pointerEvents="box-none">
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
              onPress={(event) => {
                event.stopPropagation();
                toggleMute();
              }}
              style={isMuted ? styles.mutedSpeaker : undefined}
            >
              <SpeakerHigh24Icon />
            </Pressable>
          ) : null}
          {onPressViewProducts ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View products in this post"
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                onPressViewProducts();
              }}
            >
              <ViewProducts24Icon />
            </Pressable>
          ) : null}
        </View>
      </View>
      <LandscapeVideoFullScreenModal
        media={fullScreenVideo}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        startAtSeconds={fullScreenStartSeconds}
        onClose={(positionSeconds) => {
          setFullScreenVideo(null);
          if (positionSeconds !== undefined) activeVideoController.current?.seekTo(positionSeconds);
        }}
        saveTarget={saveTarget}
        savedAccordingToServer={savedAccordingToServer}
        postActions={postActions}
        look={look}
      />
      {openedImageIndex !== null ? (
        <MediaLightbox images={imagePages} initialIndex={openedImageIndex} onClose={() => setOpenedImageIndex(null)} onDownloadImage={onDownloadMedia} postActions={postActions} />
      ) : null}
    </View>
  );
}

function MediaPagerPage({ media }: { media: Media }) {
  if (media.type === "video") return <VideoPosterOnly media={media} style={StyleSheet.absoluteFill} />;
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
  overlayAboveSeekBar: { bottom: 18 },
  overlayActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  mutedSpeaker: { opacity: 0.35 },
}));
