import { liveWaveformWindow, voiceNoteBarCount, voiceNoteBarHeight } from "@zudomart/chat-crypto";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { voiceNoteBarEnterEasing } from "./voiceNoteMotion.constant";

function LiveWaveformBar({ level, color, reduceMotion }: { readonly level: number | null; readonly color: string; readonly reduceMotion: boolean }) {
  const targetHeight = voiceNoteBarHeight(level);
  const height = useSharedValue(targetHeight);
  const scale = useSharedValue(reduceMotion || level === null ? 1 : 0);
  useEffect(() => {
    height.value = reduceMotion ? targetHeight : withTiming(targetHeight, { duration: 160, easing: Easing.linear });
  }, [height, reduceMotion, targetHeight]);
  useEffect(() => {
    scale.value = reduceMotion ? 1 : withTiming(1, { duration: 200, easing: voiceNoteBarEnterEasing });
  }, [reduceMotion, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ height: height.value, transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />;
}

export function VoiceNoteLiveWaveform({ levels, color, reduceMotion }: { readonly levels: readonly number[]; readonly color: string; readonly reduceMotion: boolean }) {
  const visibleSlots = liveWaveformWindow(levels);
  const firstSampleIndex = levels.length - visibleSlots.filter((slot) => slot !== null).length;
  let sampleOffset = 0;
  return (
    <View style={styles.waveform} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {visibleSlots.map((level, slot) => {
        const key = level === null ? `empty-${slot}` : `sample-${firstSampleIndex + sampleOffset++}`;
        return <LiveWaveformBar key={key} level={level} color={color} reduceMotion={reduceMotion} />;
      })}
    </View>
  );
}

export const voiceNoteWaveformMinimumWidth = voiceNoteBarCount * 3;

const styles = StyleSheet.create({
  waveform: { flex: 1, minWidth: voiceNoteWaveformMinimumWidth, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { width: 3, borderRadius: 2 },
});
