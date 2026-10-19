import { playedBarCount, seekFractionFromPosition, voiceNoteBarHeight } from "@zudomart/chat-crypto";
import { useRef } from "react";
import { type GestureResponderEvent, StyleSheet, View } from "react-native";

export interface VoiceNoteScrubWaveformProps {
  readonly levels: readonly number[];
  readonly playedFraction: number;
  readonly color: string;
  readonly durationSeconds: number;
  readonly disabled?: boolean;
  readonly onSeek: (fraction: number) => void;
}

export function VoiceNoteScrubWaveform({ levels, playedFraction, color, durationSeconds, disabled = false, onSeek }: VoiceNoteScrubWaveformProps) {
  const width = useRef(0);
  const played = playedBarCount(playedFraction, levels.length);
  const seekFromTouch = (event: GestureResponderEvent) => onSeek(seekFractionFromPosition(event.nativeEvent.locationX, width.current));
  const percent = Math.round(Math.min(1, Math.max(0, playedFraction)) * 100);
  const stepSeconds = durationSeconds > 0 ? Math.min(1, 5 / durationSeconds) : 0;
  return (
    <View
      style={styles.waveform}
      onLayout={(event) => {
        width.current = event.nativeEvent.layout.width;
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Voice note position"
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const direction = event.nativeEvent.actionName === "increment" ? 1 : -1;
        onSeek(Math.min(1, Math.max(0, playedFraction + direction * stepSeconds)));
      }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={seekFromTouch}
      onResponderMove={seekFromTouch}
    >
      {levels.map((level, index) => (
        <View key={index} pointerEvents="none" style={[styles.bar, { height: voiceNoteBarHeight(level), backgroundColor: color, opacity: index < played ? 1 : 0.3 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  waveform: { flex: 1, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { width: 3, borderRadius: 2 },
});
