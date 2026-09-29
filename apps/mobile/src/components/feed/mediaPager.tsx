import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { ViewProducts24Icon } from "@/components/icons";
import { ClipVideoPlayer, VideoPosterOnly } from "@/components/media/clipVideoPlayer";
import { LandscapeVideoFullScreenModal } from "@/components/media/landscapeVideoFullScreenModal";
import { calculateFeedVideoAspectRatio } from "@/components/media/videoOrientation.util";
import { colors } from "@/constants/colors.constant";
import type { Media } from "@/types";

import { AnimatedPageIndicator } from "./pageIndicator";

export interface MediaPagerProps {
  readonly media: readonly Media[];
  readonly height?: number;
  readonly isVisibleOnScreen?: boolean;
  readonly onPressViewProducts?: () => void;
}

const MAXIMUM_PAGER_WIDTH = 393;
const DEFAULT_PHOTO_PAGER_HEIGHT = 335;

export function MediaPager({ media, height: requestedHeight, isVisibleOnScreen = true, onPressViewProducts }: MediaPagerProps) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, MAXIMUM_PAGER_WIDTH);
  const firstMedia = media[0];
  const height =
    requestedHeight ?? (firstMedia?.type === "video" ? Math.round(pageWidth / calculateFeedVideoAspectRatio(firstMedia)) : DEFAULT_PHOTO_PAGER_HEIGHT);
  const [fullScreenVideo, setFullScreenVideo] = useState<Media | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const scrollOffsetX = useRef(new Animated.Value(0)).current;
  const pages: readonly Media[] = media.length > 0 ? media : [{ type: "image", url: null }];

  const updateActivePageFromScrollOffset = (offsetX: number) => {
    scrollOffsetX.setValue(offsetX);
    const nextIndex = Math.round(offsetX / pageWidth);
    if (nextIndex !== activePageIndex) setActivePageIndex(nextIndex);
  };

  return (
    <View style={[styles.root, { height }]}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
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
            ) : null}
          </View>
        )}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        {pages.length > 1 ? (
          <AnimatedPageIndicator count={pages.length} activeIndex={activePageIndex} scrollOffsetX={scrollOffsetX} pageWidth={pageWidth} />
        ) : (
          <View />
        )}
        {onPressViewProducts ? (
          <Pressable accessibilityRole="button" accessibilityLabel="View products in this post" hitSlop={10} onPress={onPressViewProducts}>
            <ViewProducts24Icon />
          </Pressable>
        ) : null}
      </View>
      <LandscapeVideoFullScreenModal media={fullScreenVideo} isMuted={false} onClose={() => setFullScreenVideo(null)} />
    </View>
  );
}

function MediaPagerPage({ media, isActive, isNearActive }: { media: Media; isActive: boolean; isNearActive: boolean }) {
  if (media.type === "video") {
    return isNearActive && isActiveOrPreloadable(media) ? (
      <ClipVideoPlayer media={media} isActive={isActive} isMuted style={StyleSheet.absoluteFill} />
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
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={imageUrl}
      transition={120}
    />
  );
}

const isActiveOrPreloadable = (media: Media) => !!(media.url || media.hlsUrl) && media.status !== "processing" && media.status !== "failed";

const styles = StyleSheet.create({
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
});
