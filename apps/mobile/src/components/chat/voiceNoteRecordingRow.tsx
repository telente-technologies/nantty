import { type VoiceNoteSession, formatVoiceNoteClock, slideToCancelAppearance } from "@zudomart/chat-crypto";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { PaperPlaneTilt24Icon, StopFill20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { VoiceNoteLiveWaveform } from "./voiceNoteLiveWaveform";
import { voiceNoteRed } from "./voiceNoteMotion.constant";

export interface VoiceNoteRecordingRowProps {
  readonly session: VoiceNoteSession;
  readonly reduceMotion: boolean;
  readonly onStop: () => void;
  readonly onStopAndSend: () => void;
}

function useBlinkingOpacity(reduceMotion: boolean) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withSequence(withTiming(0.2, { duration: 500, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })), -1);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function VoiceNoteRecordingRow({ session, reduceMotion, onStop, onStopAndSend }: VoiceNoteRecordingRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const appearance = slideToCancelAppearance(session.dragLeftPx);
  const blinkingStyle = useBlinkingOpacity(reduceMotion);
  const isDiscarding = session.phase === "discarding";
  const collapse = useSharedValue(1);
  useEffect(() => {
    collapse.value = isDiscarding ? (reduceMotion ? 0 : withTiming(0, { duration: 220 })) : 1;
  }, [collapse, isDiscarding, reduceMotion]);
  const collapseStyle = useAnimatedStyle(() => ({ opacity: collapse.value, transform: [{ scaleY: collapse.value }] }));
  const isHandsFree = session.mode === "tap";
  const clock = formatVoiceNoteClock(session.elapsedMs / 1000);

  return (
    <View
      style={[styles.row, isHandsFree && styles.handsFreeRow, { opacity: appearance.rowOpacity, transform: [{ translateX: appearance.rowTranslateX }] }]}
      accessible={!isHandsFree}
      accessibilityLiveRegion="polite"
      accessibilityLabel={isHandsFree ? undefined : "Recording. Release to keep, slide left to discard."}
    >
      <View style={[styles.status, { opacity: appearance.statusOpacity }]}>
        <Animated.View style={[styles.dot, blinkingStyle]} />
        <Text size={16} weight={500} lineHeight={20} letterSpacing={-0.16} style={styles.clock} accessibilityLabel={isHandsFree ? `Recording hands-free, ${clock}` : undefined}>
          {clock}
        </Text>
      </View>
      <Animated.View style={[styles.waveform, { opacity: appearance.waveformOpacity }, collapseStyle]}>
        <VoiceNoteLiveWaveform levels={session.levels} color={colors.text} reduceMotion={reduceMotion} />
      </Animated.View>
      {isHandsFree ? (
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop recording and listen" hitSlop={6} onPress={onStop} style={styles.stopButton} disabled={isDiscarding}>
            <StopFill20Icon size={16} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Send voice note" hitSlop={6} onPress={onStopAndSend} style={styles.sendButton} disabled={isDiscarding}>
            <PaperPlaneTilt24Icon size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flex: 1, height: "100%", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  handsFreeRow: { paddingRight: 10 },
  status: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: voiceNoteRed },
  clock: { fontVariant: ["tabular-nums"], minWidth: 36 },
  waveform: { flex: 1, flexDirection: "row" },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip },
  sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySolid },
}));
