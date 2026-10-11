import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { PauseFill24Icon, Play24Icon } from "@/components/icons";
import { UploadProgressBar } from "@/components/media/uploadProgressBar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import { type EphemeralFile, playableSourceForVoiceNote, subscribeToDecryptedFileWipes } from "@/services/chatCrypto/ephemeralDecryptedFiles.service";
import type { MessageAttachedMedia } from "@/types";

import { formatVoiceNoteDuration } from "./voiceNoteRecorder.hook";

export interface VoiceNoteBubbleProps {
  readonly media: MessageAttachedMedia;
  readonly isMine: boolean;
  readonly deliveryStatus: LocalMessageDeliveryStatus;
}

export function VoiceNoteBubble({ media, isMine, deliveryStatus }: VoiceNoteBubbleProps) {
  const { colors } = useTheme();
  const player = useAudioPlayer(null);
  const playing = useRef<{ readonly url: string; readonly file: EphemeralFile | null } | null>(null);
  const status = useAudioPlayerStatus(player);
  const durationSeconds = media.durationSeconds || status.duration || 0;
  const playedFraction = durationSeconds > 0 ? Math.min(status.currentTime / durationSeconds, 1) : 0;
  const foregroundColor = isMine ? colors.white : colors.text;

  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0).catch(() => undefined);
  }, [player, status.didJustFinish]);

  useEffect(() => {
    const unloadPlaybackFile = () => {
      if (!playing.current) return;
      player.pause();
      player.replace(null);
      playing.current.file?.release();
      playing.current = null;
    };
    const stopListening = subscribeToDecryptedFileWipes(unloadPlaybackFile);
    return () => {
      stopListening();
      unloadPlaybackFile();
    };
  }, [player]);

  const togglePlayback = () => {
    if (status.playing) return player.pause();
    if (!media.url) return;
    if (playing.current?.url !== media.url) {
      playing.current?.file?.release();
      const source = playableSourceForVoiceNote(media.id, media.url);
      if (!source) return;
      playing.current = { url: media.url, file: source.file };
      player.replace({ uri: source.uri });
    }
    player.play();
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : `Play voice note, ${formatVoiceNoteDuration(durationSeconds)}`}
        accessibilityState={{ disabled: !media.url }}
        disabled={!media.url}
        hitSlop={8}
        onPress={togglePlayback}
        style={styles.playButton}
      >
        {status.playing ? (
          <PauseFill24Icon size={18} color={foregroundColor} />
        ) : (
          <Play24Icon size={18} color={foregroundColor} />
        )}
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.trackBackground, { backgroundColor: isMine ? "rgba(255,255,255,0.35)" : colors.placeholder }]}>
          <View style={[styles.trackFill, { width: `${Math.round(playedFraction * 100)}%`, backgroundColor: foregroundColor }]} />
        </View>
        {deliveryStatus === "pending" ? (
          <UploadProgressBar jobId={media.id} showLabel={false} />
        ) : null}
      </View>
      <Text size={12} lineHeight={14.4} color={foregroundColor}>
        {formatVoiceNoteDuration(status.playing ? status.currentTime : durationSeconds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 200, flexDirection: "row", alignItems: "center", gap: 10 },
  playButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  playingButton: { opacity: 0.5 },
  track: { flex: 1, gap: 4 },
  trackBackground: { height: 3, borderRadius: 2, overflow: "hidden" },
  trackFill: { height: 3 },
});
