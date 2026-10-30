import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoxArrowDown24Icon, Cancel20Icon } from "@/components/icons";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { mediaGlass } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Media } from "@/types";

import { MediaLightboxPostActions, type MediaLightboxPostActionsProps } from "./mediaLightboxPostActions";

const DOUBLE_TAP_DELAY_MS = 260;
const ZOOMED_SCALE = 2.5;

export interface MediaLightboxProps {
  readonly images: readonly Media[];
  readonly initialIndex: number;
  readonly onClose: () => void;
  readonly onDownloadImage?: (media: Media) => void;
  readonly postActions?: MediaLightboxPostActionsProps;
}

export function MediaLightbox({ images, initialIndex, onClose, onDownloadImage, postActions }: MediaLightboxProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => setActiveIndex(initialIndex), [initialIndex]);

  if (images.length === 0) return null;

  return (
    <FrameAwareModal visible animationType="fade" transparent onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.root}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(item, index) => item.id ?? `${item.url ?? "image"}-${index}`}
          onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <LightboxPage
              media={item}
              width={width}
              height={height}
              isActive={index === activeIndex}
              onClose={onClose}
              onZoomedChange={setIsZoomed}
            />
          )}
        />
        <View
          style={[
            styles.chrome,
            {
              paddingTop: safeAreaInsets.top + 16,
              paddingLeft: Math.max(safeAreaInsets.left, 16),
              paddingRight: Math.max(safeAreaInsets.right, 16),
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" hitSlop={12} onPress={onClose} style={styles.close}>
            <Cancel20Icon color={colors.white} />
          </Pressable>
          <View style={styles.trailing}>
            <View style={styles.counter}>
              <Text size={13} lineHeight={16} color={colors.white}>
                {activeIndex + 1} / {images.length}
              </Text>
            </View>
            {onDownloadImage && images[activeIndex] ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Download image" hitSlop={12} onPress={() => onDownloadImage(images[activeIndex] as Media)} style={styles.close}>
                <BoxArrowDown24Icon size={20} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {postActions ? (
          <View
            pointerEvents="box-none"
            style={[styles.postActions, { paddingBottom: Math.max(safeAreaInsets.bottom, 16) + 12 }]}
          >
            <MediaLightboxPostActions {...postActions} />
          </View>
        ) : null}
      </View>
    </FrameAwareModal>
  );
}

function LightboxPage({
  media,
  width,
  height,
  isActive,
  onClose,
  onZoomedChange,
}: {
  readonly media: Media;
  readonly width: number;
  readonly height: number;
  readonly isActive: boolean;
  readonly onClose: () => void;
  readonly onZoomedChange: (isZoomed: boolean) => void;
}) {
  const pageStyles = usePageStyles();
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastTapAt = useRef(0);
  const pressStartedAt = useRef(0);
  const panOrigin = useRef({ x: 0, y: 0 });
  const zoomedRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (isActive) return;
    zoomedRef.current = false;
    setZoomed(false);
    onZoomedChange(false);
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [isActive, onZoomedChange, scale, translateX, translateY]);

  const resetZoom = () => {
    zoomedRef.current = false;
    setZoomed(false);
    onZoomedChange(false);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const zoomIn = (originX: number, originY: number) => {
    zoomedRef.current = true;
    setZoomed(true);
    onZoomedChange(true);
    translateX.setValue((width / 2 - originX) * (ZOOMED_SCALE - 1));
    translateY.setValue((height / 2 - originY) * (ZOOMED_SCALE - 1));
    Animated.parallel([
      Animated.spring(scale, { toValue: ZOOMED_SCALE, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => zoomedRef.current,
      onMoveShouldSetPanResponder: (_, gesture) => zoomedRef.current && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderGrant: () => {
        pressStartedAt.current = Date.now();
        panOrigin.current = { x: 0, y: 0 };
      },
      onPanResponderMove: (_, gesture) => {
        panOrigin.current = { x: gesture.dx, y: gesture.dy };
        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: () => {
        const isTap = Math.abs(panOrigin.current.x) < 6 && Math.abs(panOrigin.current.y) < 6 && Date.now() - pressStartedAt.current < 300;
        panOrigin.current = { x: 0, y: 0 };
        if (isTap) resetZoom();
      },
      onPanResponderTerminate: () => {
        panOrigin.current = { x: 0, y: 0 };
      },
    }),
  ).current;

  const handlePress = (event: { readonly nativeEvent: { readonly pageX: number; readonly pageY: number } }) => {
    const now = Date.now();
    const isDoubleTap = now - lastTapAt.current < DOUBLE_TAP_DELAY_MS;
    lastTapAt.current = now;
    if (isDoubleTap) {
      if (zoomedRef.current) resetZoom();
      else zoomIn(event.nativeEvent.pageX, event.nativeEvent.pageY);
      lastTapAt.current = 0;
      return;
    }
    if (!zoomedRef.current) onClose();
  };

  const imageUrl = media.url ?? media.posterUrl ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={zoomed ? "Zoomed image, tap to fit" : "Image, tap to close, double tap to zoom"}
      onPress={handlePress}
      style={[pageStyles.page, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[pageStyles.imageBox, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
            transition={120}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
    alignItems: "center",
    justifyContent: "center",
  },
  trailing: { flexDirection: "row", alignItems: "center", gap: 10 },
  postActions: { position: "absolute", left: 0, right: 0, bottom: 0 },
  counter: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
    alignItems: "center",
    justifyContent: "center",
  },
}));

const usePageStyles = makeThemedStyles((colors) => StyleSheet.create({
  page: { alignItems: "center", justifyContent: "center", backgroundColor: colors.black },
  imageBox: { alignItems: "center", justifyContent: "center" },
}));
