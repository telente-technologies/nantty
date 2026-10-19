import { type VoiceNoteSession, slideToCancelAppearance } from "@zudomart/chat-crypto";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { makeThemedStyles, useTheme } from "@/theme";

import { voiceNoteCancelPopEasing, voiceNotePillActiveWidth, voiceNotePillHeight, voiceNotePillIdleWidth, voiceNotePillWidthEasing, voiceNoteRed } from "./voiceNoteMotion.constant";
import { VoiceNotePreviewRow } from "./voiceNotePreviewRow";
import { VoiceNoteRecordingRow } from "./voiceNoteRecordingRow";

export interface VoiceNoteRecordingPillProps {
  readonly session: VoiceNoteSession;
  readonly previewFile: LocalMediaFile | null;
  readonly availableWidth: number;
  readonly reduceMotion: boolean;
  readonly onStop: () => void;
  readonly onStopAndSend: () => void;
  readonly onDiscard: () => void;
  readonly onSendPreview: () => void;
}

const hintOffsetFromPillCentre = 42;
const hintLineHeight = 16;

function useCancelBadgeStyle(isArmed: boolean, reduceMotion: boolean) {
  const scale = useSharedValue(0.4);
  useEffect(() => {
    if (!isArmed) scale.value = 0.4;
    else scale.value = reduceMotion ? 1 : withTiming(1, { duration: 420, easing: voiceNoteCancelPopEasing });
  }, [isArmed, reduceMotion, scale]);
  return useAnimatedStyle(() => ({ opacity: isArmed ? 1 : 0, transform: [{ scale: scale.value }] }));
}

export function VoiceNoteRecordingPill({ session, previewFile, availableWidth, reduceMotion, onStop, onStopAndSend, onDiscard, onSendPreview }: VoiceNoteRecordingPillProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const targetWidth = Math.max(voiceNotePillIdleWidth, Math.min(voiceNotePillActiveWidth, availableWidth - 16));
  const width = useSharedValue(reduceMotion ? targetWidth : voiceNotePillIdleWidth);
  useEffect(() => {
    width.value = reduceMotion ? targetWidth : withTiming(targetWidth, { duration: 420, easing: voiceNotePillWidthEasing });
  }, [reduceMotion, targetWidth, width]);
  const widthStyle = useAnimatedStyle(() => ({ width: width.value }));
  const isHoldRecording = session.phase === "recording" && session.mode === "hold";
  const appearance = slideToCancelAppearance(session.dragLeftPx);
  const cancelBadgeStyle = useCancelBadgeStyle(isHoldRecording && appearance.isArmed, reduceMotion);

  return (
    <View style={styles.overlay} pointerEvents={isHoldRecording ? "none" : "auto"}>
      {isHoldRecording ? (
        <View style={styles.hint} pointerEvents="none">
          <Text size={13} weight={500} lineHeight={hintLineHeight} letterSpacing={-0.13} color={appearance.isArmed ? voiceNoteRed : colors.textFaint} align="center" style={styles.hintText}>
            {appearance.isArmed ? "Release to cancel" : "‹ Slide to cancel"}
          </Text>
        </View>
      ) : null}
      <Animated.View style={[styles.pill, widthStyle]}>
        {session.phase === "preview" ? (
          <VoiceNotePreviewRow levels={session.levels} recordedSeconds={session.elapsedMs / 1000} previewFile={previewFile} reduceMotion={reduceMotion} onDiscard={onDiscard} onSend={onSendPreview} />
        ) : (
          <VoiceNoteRecordingRow session={session} reduceMotion={reduceMotion} onStop={onStop} onStopAndSend={onStopAndSend} />
        )}
        <Animated.View style={[styles.cancelBadge, cancelBadgeStyle]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Cancel20Icon size={16} color={colors.white} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hint: { position: "absolute", left: 0, right: 0, top: "50%", marginTop: -hintOffsetFromPillCentre - hintLineHeight / 2 - 6, alignItems: "center" },
  hintText: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden", backgroundColor: colors.surface },
  pill: {
    height: voiceNotePillHeight,
    borderRadius: voiceNotePillHeight / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.divider,
    backgroundColor: colors.elevated,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cancelBadge: { position: "absolute", left: 14, top: (voiceNotePillHeight - 28) / 2 - 1, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: voiceNoteRed },
}));
