import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowsInSimpleIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerXIcon,
  XIcon,
} from "@/components/icons/phosphorGlyphs";
import { mediaGlass } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { SEEK_STEP_SECONDS, formatPlaybackTime, isScrubbableDuration } from "@/utils/videoSeek.util";

import type { VideoPlaybackProgress } from "./clipVideoPlayer";
import { VideoSeekBar } from "./videoSeekBar";

export interface FullScreenVideoControlsProps {
  readonly progress: VideoPlaybackProgress;
  readonly isPaused: boolean;
  readonly isMuted: boolean;
  readonly canSeek: boolean;
  readonly topCenter?: ReactNode;
  readonly topRight?: ReactNode;
  readonly onTogglePlay: () => void;
  readonly onSeekBy: (deltaSeconds: number) => void;
  readonly onScrubStart: () => void;
  readonly onScrubEnd: (targetSeconds: number | null) => void;
  readonly onToggleMute: () => void;
  readonly onExit: () => void;
}

const EDGE = 16;
const INK = colors.white;

function RoundButton({ label, onPress, size = 44, children }: { label: string; onPress: () => void; size?: number; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}>
      {children}
    </Pressable>
  );
}

function SkipButton({ direction, onPress }: { direction: "back" | "ahead"; onPress: () => void }) {
  const Arrow = direction === "back" ? ArrowCounterClockwiseIcon : ArrowClockwiseIcon;
  return (
    <RoundButton label={`Skip ${direction} ${SEEK_STEP_SECONDS} seconds`} onPress={onPress} size={52}>
      <Arrow size={30} weight="bold" color={INK} />
      <Text size={10} weight={700} lineHeight={12} color={INK} style={styles.skipLabel}>
        {SEEK_STEP_SECONDS}
      </Text>
    </RoundButton>
  );
}

export function FullScreenVideoControls(props: FullScreenVideoControlsProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const { progress } = props;
  const showSkips = props.canSeek && isScrubbableDuration(progress.durationSeconds);
  const Speaker = props.isMuted ? SpeakerXIcon : SpeakerHighIcon;
  return (
    <Animated.View
      pointerEvents="box-none"
      entering={reducedMotion ? undefined : FadeIn.duration(150)}
      exiting={reducedMotion ? undefined : FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
    >
      <View pointerEvents="none" style={[styles.scrim, styles.topScrim]} />
      <View pointerEvents="none" style={[styles.scrim, styles.bottomScrim]} />
      <View pointerEvents="box-none" style={[styles.topRow, { paddingTop: Math.max(insets.top, EDGE), paddingLeft: Math.max(insets.left, EDGE), paddingRight: Math.max(insets.right, EDGE) }]}>
        <RoundButton label="Close video" onPress={props.onExit} size={36}>
          <XIcon size={18} weight="bold" color={INK} />
        </RoundButton>
        <View pointerEvents="box-none" style={styles.topCenter}>{props.topCenter}</View>
        <View style={styles.topRight}>{props.topRight}</View>
      </View>
      <View pointerEvents="box-none" style={styles.centerRow}>
        {showSkips ? <SkipButton direction="back" onPress={() => props.onSeekBy(-SEEK_STEP_SECONDS)} /> : null}
        <RoundButton label={props.isPaused ? "Play" : "Pause"} onPress={props.onTogglePlay} size={68}>
          {props.isPaused ? <PlayIcon size={32} weight="fill" color={INK} /> : <PauseIcon size={32} weight="fill" color={INK} />}
        </RoundButton>
        {showSkips ? <SkipButton direction="ahead" onPress={() => props.onSeekBy(SEEK_STEP_SECONDS)} /> : null}
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, EDGE / 2), paddingLeft: Math.max(insets.left, EDGE), paddingRight: Math.max(insets.right, EDGE) }]}
      >
        <View pointerEvents="box-none" style={styles.bottomRow}>
          <Text size={13} weight={600} lineHeight={16} color={INK} accessibilityLabel={`${formatPlaybackTime(progress.currentSeconds)} of ${formatPlaybackTime(progress.durationSeconds)}`}>
            {`${formatPlaybackTime(progress.currentSeconds)} / ${formatPlaybackTime(progress.durationSeconds)}`}
          </Text>
          <View style={styles.bottomActions}>
            <RoundButton label={props.isMuted ? "Unmute" : "Mute"} onPress={props.onToggleMute} size={36}>
              <Speaker size={20} weight="bold" color={INK} />
            </RoundButton>
            <RoundButton label="Exit full screen" onPress={props.onExit} size={36}>
              <ArrowsInSimpleIcon size={20} weight="bold" color={INK} />
            </RoundButton>
          </View>
        </View>
        <VideoSeekBar
          variant="fullscreen"
          currentSeconds={progress.currentSeconds}
          durationSeconds={progress.durationSeconds}
          bufferedSeconds={progress.bufferedSeconds}
          canSeek={props.canSeek}
          onScrubStart={props.onScrubStart}
          onScrubEnd={props.onScrubEnd}
          onSeekBy={props.onSeekBy}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, height: 120 },
  topScrim: { top: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  bottomScrim: { bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  topRow: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  topCenter: { flex: 1, alignItems: "center" },
  topRight: { minWidth: 36, alignItems: "flex-end" },
  centerRow: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 4 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bottomActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
  },
  skipLabel: { position: "absolute", top: 19 },
});
