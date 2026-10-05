import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MartHighlight } from "@/types/martHighlight.type";

export const MART_CAROUSEL_AUTO_ADVANCE_MS = 5000;
const HEIGHT = 140;
const MEDIA_SCRIM = "rgba(0, 0, 0, 0.62)";

export interface MartHighlightsCarouselProps {
  readonly highlights: readonly MartHighlight[];
  readonly loading: boolean;
  readonly visible: boolean;
  readonly onPressHighlight: (highlight: MartHighlight) => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

function useForegroundAndScreenReader() {
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => mounted && setScreenReader(value)).catch(() => undefined);
    const readerSubscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    const appSubscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => {
      mounted = false;
      readerSubscription.remove();
      appSubscription.remove();
    };
  }, []);
  return { foreground, screenReader };
}

export function MartHighlightsCarousel({ highlights, loading, visible, onPressHighlight, onLayout }: MartHighlightsCarouselProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotionPreference();
  const { foreground, screenReader } = useForegroundAndScreenReader();
  const listRef = useRef<FlatList<MartHighlight>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const count = highlights.length;
  const highlightIds = highlights.map((highlight) => highlight.id).join("|");

  useEffect(() => {
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [highlightIds]);

  const goTo = useCallback((requested: number) => {
    if (count === 0 || width === 0) return;
    const target = (requested + count) % count;
    listRef.current?.scrollToOffset({ offset: target * width, animated: !reduceMotion && target !== 0 });
    setIndex(target);
  }, [count, width, reduceMotion]);

  const autoAdvance = visible && focused && foreground && !touching && !reduceMotion && !screenReader && count > 1 && width > 0;
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setTimeout(() => goTo(index + 1), MART_CAROUSEL_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [autoAdvance, index, goTo]);

  const onMomentumScrollEnd = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.min(count - 1, Math.max(0, Math.round(nativeEvent.contentOffset.x / width))));
  };

  if (count === 0) {
    return loading ? <View style={styles.placeholder} onLayout={onLayout} accessibilityLabel="Loading highlights" /> : null;
  }

  const current = highlights[Math.min(index, count - 1)]!;
  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
        onLayout?.(event);
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Highlights, ${index + 1} of ${count}. ${current.title}. ${current.ranking.reason.label}`}
      accessibilityHint="Swipe up or down to change highlight. Double tap to open."
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "increment") goTo(index + 1);
        if (nativeEvent.actionName === "decrement") goTo(index - 1);
        if (nativeEvent.actionName === "activate") onPressHighlight(current);
      }}
    >
      <FlatList
        ref={listRef}
        data={highlights}
        keyExtractor={(highlight) => highlight.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
        onScrollBeginDrag={() => setTouching(true)}
        onScrollEndDrag={() => setTouching(false)}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <Pressable accessible={false} onPress={() => onPressHighlight(item)} style={[styles.slide, { width }]}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion ? 0 : 200} /> : null}
            <View style={styles.caption}>
              <Text size={15} weight={600} lineHeight={19} color={colors.white} numberOfLines={1}>{item.title}</Text>
              <Text size={11} lineHeight={15} color={colors.white} numberOfLines={1}>{item.ranking.reason.label}</Text>
            </View>
          </Pressable>
        )}
      />
      {count > 1 ? (
        <View style={styles.dots} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {highlights.map((highlight, dotIndex) => (
            <View key={highlight.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { height: HEIGHT, borderRadius: 6, overflow: "hidden", backgroundColor: colors.placeholder },
  placeholder: { height: HEIGHT, borderRadius: 6, backgroundColor: colors.placeholder },
  slide: { height: HEIGHT, justifyContent: "flex-end" },
  caption: { margin: 10, marginBottom: 22, alignSelf: "flex-start", maxWidth: "80%", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: MEDIA_SCRIM, gap: 1 },
  dots: { position: "absolute", bottom: 8, alignSelf: "center", flexDirection: "row", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: MEDIA_SCRIM },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white, opacity: 0.5 },
  dotActive: { width: 14, opacity: 1 },
}));
