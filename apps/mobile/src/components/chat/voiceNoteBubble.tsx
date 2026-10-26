import { formatVoiceNoteClock, formatVoiceNotePlaybackRate, voiceNoteDisplayLevels } from "@nantty/chat-crypto";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { UploadProgressBar } from "@/components/media/uploadProgressBar";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import { playableSourceForVoiceNote, subscribeToDecryptedFileWipes } from "@/services/chatCrypto/ephemeralDecryptedFiles.service";
import type { MessageAttachedMedia } from "@/types";

import { PlayPauseMorphIcon } from "./playPauseMorphIcon";
import { type PlayableVoiceNoteSource, useVoiceNotePlayer } from "./voiceNotePlayer.hook";
import { VoiceNoteScrubWaveform } from "./voiceNoteScrubWaveform";

export interface VoiceNoteBubbleProps {
  readonly media: MessageAttachedMedia;
  readonly waveformPeaks?: readonly number[] | null;
  readonly isMine: boolean;
  readonly deliveryStatus: LocalMessageDeliveryStatus;
}

export function VoiceNoteBubble({ media, waveformPeaks, isMine, deliveryStatus }: VoiceNoteBubbleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const player = useVoiceNotePlayer(`voice-note-${media.id}`, media.durationSeconds || 0);
  const foregroundColor = isMine ? colors.white : colors.text;
  const bubbleColor = isMine ? colors.primarySolid : colors.skeleton;
  const peaks = waveformPeaks ?? media.localWaveform ?? null;
  const bars = useMemo(() => voiceNoteDisplayLevels(peaks, media.id), [media.id, peaks]);
  const sourceKey = media.url ?? "";
  const isPlayable = !!media.url;

  useEffect(() => subscribeToDecryptedFileWipes(player.unload), [player.unload]);

  const resolveSource = (): PlayableVoiceNoteSource | null => {
    const source = playableSourceForVoiceNote(media.id, media.url);
    if (!source) return null;
    return { uri: source.uri, release: source.file ? () => source.file?.release() : null };
  };

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={player.isPlaying ? "Pause voice note" : `Play voice note, ${formatVoiceNoteClock(player.durationSeconds)}`}
          accessibilityState={{ disabled: !isPlayable }}
          disabled={!isPlayable}
          hitSlop={6}
          onPress={() => (player.isPlaying ? player.pause() : player.play(sourceKey, resolveSource))}
          style={({ pressed }) => [styles.playButton, { backgroundColor: foregroundColor }, pressed && !reduceMotion && styles.pressed, !isPlayable && styles.unavailable]}
        >
          <PlayPauseMorphIcon isPlaying={player.isPlaying} color={bubbleColor} size={18} reduceMotion={reduceMotion} />
        </Pressable>
        <VoiceNoteScrubWaveform
          levels={bars}
          playedFraction={player.hasStarted ? player.playedFraction : 0}
          color={foregroundColor}
          durationSeconds={player.durationSeconds}
          disabled={!isPlayable}
          onSeek={(fraction) => player.seekToFraction(sourceKey, resolveSource, fraction)}
        />
        <Text size={12} weight={500} lineHeight={14.4} letterSpacing={0} color={foregroundColor} style={styles.clock}>
          {formatVoiceNoteClock(player.hasStarted ? player.currentTime : player.durationSeconds)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${formatVoiceNotePlaybackRate(player.playbackRate)}`}
          accessibilityHint="Changes how fast this voice note plays"
          hitSlop={6}
          onPress={player.cyclePlaybackRate}
          style={[styles.speedChip, { borderColor: foregroundColor }]}
        >
          <Text size={11} weight={600} lineHeight={13} letterSpacing={0} color={foregroundColor} style={styles.speedLabel}>
            {formatVoiceNotePlaybackRate(player.playbackRate)}
          </Text>
        </Pressable>
      </View>
      {deliveryStatus === "pending" ? <UploadProgressBar jobId={media.id} showLabel={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 228, gap: 6 },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  playButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.96 }] },
  unavailable: { opacity: 0.5 },
  clock: { fontVariant: ["tabular-nums"], minWidth: 30 },
  speedLabel: { fontVariant: ["tabular-nums"], textAlign: "center" },
  speedChip: { minWidth: 34, height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", opacity: 0.85 },
});
