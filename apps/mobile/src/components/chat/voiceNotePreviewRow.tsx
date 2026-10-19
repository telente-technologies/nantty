import { downsampleLevelsByBucketMax, formatVoiceNoteClock, voiceNoteBarCount } from "@zudomart/chat-crypto";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { makeThemedStyles, useTheme } from "@/theme";

import { PlayPauseMorphIcon } from "./playPauseMorphIcon";
import { voiceNotePillHeight } from "./voiceNoteMotion.constant";
import { useVoiceNotePlayer } from "./voiceNotePlayer.hook";
import { VoiceNoteScrubWaveform } from "./voiceNoteScrubWaveform";

export interface VoiceNotePreviewRowProps {
  readonly levels: readonly number[];
  readonly recordedSeconds: number;
  readonly previewFile: LocalMediaFile | null;
  readonly reduceMotion: boolean;
  readonly onDiscard: () => void;
  readonly onSend: () => void;
}

export function VoiceNotePreviewRow({ levels, recordedSeconds, previewFile, reduceMotion, onDiscard, onSend }: VoiceNotePreviewRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const player = useVoiceNotePlayer("composer-preview", recordedSeconds);
  const bars = useMemo(() => downsampleLevelsByBucketMax(levels, voiceNoteBarCount), [levels]);
  const sourceKey = previewFile?.uri ?? "";
  const resolveSource = () => (previewFile ? { uri: previewFile.uri, release: null } : null);
  const shownSeconds = player.hasStarted ? player.currentTime : recordedSeconds;
  const finish = (action: () => void) => {
    player.unload();
    action();
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={player.isPlaying ? "Pause voice note" : `Play voice note, ${formatVoiceNoteClock(recordedSeconds)}`}
        accessibilityState={{ disabled: !previewFile }}
        disabled={!previewFile}
        onPress={() => (player.isPlaying ? player.pause() : player.play(sourceKey, resolveSource))}
        style={({ pressed }) => [styles.playButton, pressed && !reduceMotion && styles.pressed, !previewFile && styles.unavailable]}
      >
        <PlayPauseMorphIcon isPlaying={player.isPlaying} color={colors.elevated} reduceMotion={reduceMotion} />
      </Pressable>
      <VoiceNoteScrubWaveform
        levels={bars}
        playedFraction={player.hasStarted ? player.playedFraction : 0}
        color={colors.text}
        durationSeconds={player.durationSeconds}
        disabled={!previewFile}
        onSeek={(fraction) => player.seekToFraction(sourceKey, resolveSource, fraction)}
      />
      <Text size={16} weight={500} lineHeight={20} letterSpacing={-0.16} style={styles.clock}>
        {formatVoiceNoteClock(shownSeconds)}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Discard voice note" hitSlop={6} onPress={() => finish(onDiscard)} style={styles.discardButton}>
        <Cancel20Icon size={16} color={colors.text} style={styles.discardIcon} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send voice note"
        accessibilityState={{ disabled: !previewFile }}
        disabled={!previewFile}
        hitSlop={6}
        onPress={() => finish(onSend)}
        style={[styles.sendButton, !previewFile && styles.unavailable]}
      >
        <PaperPlaneTilt24Icon size={18} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flex: 1, height: "100%", flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 6, paddingRight: 10 },
  playButton: { width: 44, height: 44, borderRadius: voiceNotePillHeight / 2 - 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.text },
  pressed: { transform: [{ scale: 0.96 }] },
  unavailable: { opacity: 0.5 },
  clock: { fontVariant: ["tabular-nums"], minWidth: 36, textAlign: "right" },
  discardButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  discardIcon: { opacity: 0.5 },
  sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySolid },
}));
