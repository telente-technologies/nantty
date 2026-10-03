import { Pressable, StyleSheet, View } from "react-native";

import { ArrowsOutSimple24Icon, Play24Icon, SpeakerHigh24Icon, Speedometer24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface ClipPlaybackControlsProps {
  readonly remainingSeconds: number;
  readonly progress: number;
  readonly isMuted?: boolean;
  readonly playbackSpeed?: number;
  readonly onPressPlay: () => void;
  readonly onPressSpeed: () => void;
  readonly onPressVolume: () => void;
  readonly onPressFullscreen: () => void;
}

const formatRemainingPlaybackTime = (seconds: number) => `-${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function ClipPlaybackControls(props: ClipPlaybackControlsProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const played = Math.min(Math.max(props.progress, 0), 1);
  return (
    <View style={styles.root}>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(played * 100) }}>
        <View style={[styles.segment, { flex: Math.max(played, 0.001) }]} />
        <View style={[styles.segment, { flex: Math.max(1 - played, 0.001) }]} />
      </View>
      <View style={styles.row}>
        <View style={styles.left}>
          <Pressable accessibilityRole="button" accessibilityLabel="Play" hitSlop={10} onPress={props.onPressPlay}>
            <Play24Icon />
          </Pressable>
          <Text size={13} lineHeight={16.9}>
            {formatRemainingPlaybackTime(props.remainingSeconds)}
          </Text>
        </View>
        <View style={styles.right}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${props.playbackSpeed ?? 1}x`}
            hitSlop={8}
            onPress={props.onPressSpeed}
            style={styles.speed}
          >
            <Speedometer24Icon />
            {props.playbackSpeed && props.playbackSpeed !== 1 ? (
              <Text size={11} weight={600} lineHeight={13.2} letterSpacing={0}>
                {props.playbackSpeed}x
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.isMuted ? "Unmute" : "Mute"}
            accessibilityState={{ selected: !!props.isMuted }}
            hitSlop={8}
            onPress={props.onPressVolume}
            style={props.isMuted ? styles.mutedSpeaker : undefined}
          >
            <SpeakerHigh24Icon />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Full screen" hitSlop={8} onPress={props.onPressFullscreen}>
            <ArrowsOutSimple24Icon />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { backgroundColor: colors.surface },
  progress: { height: 2, flexDirection: "row", gap: 4 },
  segment: { height: 2, borderRadius: 4, backgroundColor: colors.text },
  row: { height: 50, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 14 },
  right: { flexDirection: "row", alignItems: "center", gap: 22 },
  speed: { flexDirection: "row", alignItems: "center", gap: 2 },
  mutedSpeaker: { opacity: 0.35 },
}));
