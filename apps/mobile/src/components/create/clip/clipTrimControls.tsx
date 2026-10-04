import { Pressable, StyleSheet, View } from "react-native";

import { Minus16Icon, Plus16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { clampTrim, formatClipSeconds, type ClipTrim } from "./clipDraft.util";

export interface ClipTrimControlsProps {
  readonly durationSeconds: number | null;
  readonly trim: ClipTrim | null;
  readonly onChange: (trim: ClipTrim) => void;
}

function Stepper({ label, value, onStep }: { label: string; value: number; onStep: (delta: number) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <Text size={13} weight={500} lineHeight={16.9} style={styles.stepperLabel}>{label} {formatClipSeconds(value)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} one second earlier`} hitSlop={6} onPress={() => onStep(-1)} style={styles.stepButton}>
        <Minus16Icon color={colors.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} one second later`} hitSlop={6} onPress={() => onStep(1)} style={styles.stepButton}>
        <Plus16Icon color={colors.text} />
      </Pressable>
    </View>
  );
}

export function ClipTrimControls({ durationSeconds, trim, onChange }: ClipTrimControlsProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (!durationSeconds || !trim) {
    return <Text size={13} lineHeight={18} color={colors.textMuted}>Trimming isn’t available for this video. It will post at its full length.</Text>;
  }
  const startPercent = (trim.startSeconds / durationSeconds) * 100;
  const widthPercent = ((trim.endSeconds - trim.startSeconds) / durationSeconds) * 100;
  const change = (next: ClipTrim) => onChange(clampTrim(next, durationSeconds));
  return (
    <View style={styles.root}>
      <View style={styles.track} accessibilityLabel={`Keeping ${formatClipSeconds(trim.startSeconds)} to ${formatClipSeconds(trim.endSeconds)} of ${formatClipSeconds(durationSeconds)}`}>
        <View style={[styles.kept, { left: `${startPercent}%`, width: `${widthPercent}%` }]} />
      </View>
      <Stepper label="Start" value={trim.startSeconds} onStep={(delta) => change({ ...trim, startSeconds: trim.startSeconds + delta })} />
      <Stepper label="End" value={trim.endSeconds} onStep={(delta) => change({ ...trim, endSeconds: trim.endSeconds + delta })} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 10 },
  track: { height: 28, borderRadius: 6, backgroundColor: colors.chip, overflow: "hidden" },
  kept: { position: "absolute", top: 0, bottom: 0, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryTint },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperLabel: { flex: 1 },
  stepButton: { width: 44, height: 36, borderRadius: 18, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
}));
