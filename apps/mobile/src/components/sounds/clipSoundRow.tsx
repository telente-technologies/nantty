import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { SpeakerHigh24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { describeClipSoundForDisplay } from "@/services/clips/sounds.service";
import type { ClipSound } from "@/types";

export interface ClipSoundRowProps {
  readonly sound: ClipSound;
  readonly isActive: boolean;
  readonly foregroundColor?: string;
  readonly onPress: () => void;
}

const MARQUEE_PIXELS_PER_SECOND = 30;
const MARQUEE_GAP_PIXELS = 32;

export function ClipSoundRow({ sound, isActive, foregroundColor, onPress }: ClipSoundRowProps) {
  const label = describeClipSoundForDisplay(sound);
  const [visibleWidth, setVisibleWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const scrollOffset = useRef(new Animated.Value(0)).current;
  const needsMarquee = labelWidth > visibleWidth && visibleWidth > 0;

  useEffect(() => {
    scrollOffset.setValue(0);
    if (!needsMarquee || !isActive) return;
    const travelDistance = labelWidth + MARQUEE_GAP_PIXELS;
    const loop = Animated.loop(
      Animated.timing(scrollOffset, {
        toValue: -travelDistance,
        duration: (travelDistance / MARQUEE_PIXELS_PER_SECOND) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [needsMarquee, isActive, labelWidth, scrollOffset]);

  const isUnderReview = sound.status === "under_copyright_review";
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Sound: ${label}${isUnderReview ? ". Unavailable while under copyright review" : ""}`}
      onPress={onPress}
      hitSlop={14}
      style={styles.row}
    >
      <SpeakerHigh24Icon size={14} color={foregroundColor} />
      <View style={styles.window} onLayout={(event) => setVisibleWidth(event.nativeEvent.layout.width)}>
        <Animated.View style={[styles.track, { transform: [{ translateX: scrollOffset }] }]}>
          <Text
            size={12}
            lineHeight={16.8}
            color={foregroundColor}
            numberOfLines={1}
            style={[styles.readableOnVideo, styles.label]}
            onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
          >
            {label}
          </Text>
          {needsMarquee ? (
            <Text size={12} lineHeight={16.8} color={foregroundColor} numberOfLines={1} style={[styles.readableOnVideo, styles.repeat]}>
              {label}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 220 },
  window: { flex: 1, height: 17, overflow: "hidden" },
  track: { flexDirection: "row", width: 2000 },
  repeat: { marginLeft: MARQUEE_GAP_PIXELS, flexShrink: 0 },
  label: { flexShrink: 0 },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
