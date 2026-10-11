import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import {
  SEEK_STEP_SECONDS,
  VIDEO_SEEK_BAR_TOUCH_HEIGHT,
  clampFraction,
  formatPlaybackTime,
  fractionFromTouch,
  isScrubbableDuration,
  scrubFraction,
  secondsAtFraction,
} from "@/utils/videoSeek.util";

export type VideoSeekBarVariant = "overlay" | "fullscreen";

export interface VideoSeekBarProps {
  readonly currentSeconds: number;
  readonly durationSeconds: number;
  readonly bufferedSeconds?: number;
  readonly variant?: VideoSeekBarVariant;
  readonly canSeek?: boolean;
  readonly onScrubStart?: () => void;
  readonly onScrubEnd: (targetSeconds: number | null) => void;
  readonly onSeekBy: (deltaSeconds: number) => void;
  readonly style?: StyleProp<ViewStyle>;
}

const FULLSCREEN_TOUCH_HEIGHT = 36;
const HOLD_AFTER_RELEASE_MS = 1000;
const LANDED_TOLERANCE_SECONDS = 0.75;
const BUBBLE_WIDTH = 124;
const OVERLAY_TRACK_LIFT = 4;
const TRACK = { overlay: { idle: 2, active: 6 }, fullscreen: { idle: 4, active: 8 } } as const;
const THUMB = { idle: 12, active: 16 } as const;

const playGrabHaptic = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
};

export function VideoSeekBar({
  currentSeconds,
  durationSeconds,
  bufferedSeconds = 0,
  variant = "overlay",
  canSeek = true,
  onScrubStart,
  onScrubEnd,
  onSeekBy,
  style,
}: VideoSeekBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubbingFraction, setScrubbingFraction] = useState<number | null>(null);
  const [heldFraction, setHeldFraction] = useState<number | null>(null);
  const grab = useRef<{ fraction: number; pageX: number; latest: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractive = canSeek && isScrubbableDuration(durationSeconds);
  const isScrubbing = scrubbingFraction !== null;

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeldFraction(null);
  };

  const cancelScrub = () => {
    if (!grab.current) return;
    grab.current = null;
    setScrubbingFraction(null);
    onScrubEnd(null);
  };

  useEffect(() => {
    if (!isInteractive) cancelScrub();
  });

  const latestOnScrubEnd = useRef(onScrubEnd);
  useEffect(() => {
    latestOnScrubEnd.current = onScrubEnd;
  });

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (grab.current) latestOnScrubEnd.current(null);
  }, []);

  useEffect(() => {
    if (heldFraction === null) return;
    if (Math.abs(currentSeconds - secondsAtFraction(heldFraction, durationSeconds)) <= LANDED_TOLERANCE_SECONDS) clearHold();
  }, [currentSeconds, durationSeconds, heldFraction]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width === trackWidth) return;
    cancelScrub();
    setTrackWidth(width);
  };

  const handleGrant = (event: GestureResponderEvent) => {
    clearHold();
    const fraction = fractionFromTouch(event.nativeEvent.locationX, trackWidth);
    grab.current = { fraction, pageX: event.nativeEvent.pageX, latest: fraction };
    setScrubbingFraction(fraction);
    playGrabHaptic();
    onScrubStart?.();
  };

  const handleMove = (event: GestureResponderEvent) => {
    if (!grab.current) return;
    grab.current.latest = scrubFraction(grab.current.fraction, grab.current.pageX, event.nativeEvent.pageX, trackWidth);
    setScrubbingFraction(grab.current.latest);
  };

  const handleRelease = () => {
    if (!grab.current) return;
    const fraction = grab.current.latest;
    grab.current = null;
    setScrubbingFraction(null);
    setHeldFraction(fraction);
    holdTimer.current = setTimeout(() => setHeldFraction(null), HOLD_AFTER_RELEASE_MS);
    onScrubEnd(secondsAtFraction(fraction, durationSeconds));
  };

  const playedFraction = scrubbingFraction ?? heldFraction ?? (durationSeconds > 0 ? clampFraction(currentSeconds / durationSeconds) : 0);
  const bufferedFraction = durationSeconds > 0 ? Math.max(clampFraction(bufferedSeconds / durationSeconds), playedFraction) : 0;
  const trackHeight = TRACK[variant][isScrubbing ? "active" : "idle"];
  const thumbSize = THUMB[isScrubbing ? "active" : "idle"];
  const showThumb = isInteractive && (isScrubbing || variant === "fullscreen");
  const thumbLeft = playedFraction * trackWidth - thumbSize / 2;
  const bubbleLeft = Math.min(Math.max(playedFraction * trackWidth - BUBBLE_WIDTH / 2, 0), Math.max(trackWidth - BUBBLE_WIDTH, 0));
  const displayedSeconds = secondsAtFraction(playedFraction, durationSeconds);
  const timeLabel = `${formatPlaybackTime(displayedSeconds)} / ${formatPlaybackTime(durationSeconds)}`;
  const touchHeight = variant === "fullscreen" ? FULLSCREEN_TOUCH_HEIGHT : VIDEO_SEEK_BAR_TOUCH_HEIGHT;

  return (
    <View
      style={[styles.root, { height: touchHeight }, variant === "fullscreen" ? styles.centered : styles.bottomAligned, style]}
      onLayout={handleLayout}
      pointerEvents={isInteractive ? "auto" : "none"}
      accessible
      accessibilityRole={isInteractive ? "adjustable" : "progressbar"}
      accessibilityLabel="Video progress"
      accessibilityHint={isInteractive ? `Swipe up or down to skip ${SEEK_STEP_SECONDS} seconds` : undefined}
      accessibilityValue={{ text: `${formatPlaybackTime(displayedSeconds)} of ${formatPlaybackTime(durationSeconds)}` }}
      accessibilityActions={isInteractive ? [{ name: "increment" }, { name: "decrement" }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onSeekBy(SEEK_STEP_SECONDS);
        if (event.nativeEvent.actionName === "decrement") onSeekBy(-SEEK_STEP_SECONDS);
      }}
      onStartShouldSetResponder={() => isInteractive && trackWidth > 0}
      onMoveShouldSetResponder={() => isInteractive && trackWidth > 0}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={cancelScrub}
    >
      <View pointerEvents="none" style={[styles.track, { height: trackHeight, borderRadius: trackHeight / 2 }, variant === "overlay" && !isScrubbing ? styles.edgeTrack : null]}>
        <View style={[styles.buffered, { width: `${bufferedFraction * 100}%` }]} />
        <View style={[styles.played, { width: `${playedFraction * 100}%` }]} />
      </View>
      {showThumb ? (
        <View
          pointerEvents="none"
          style={[styles.thumb, { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, left: thumbLeft, ...(variant === "fullscreen" ? { top: (touchHeight - thumbSize) / 2 } : { bottom: OVERLAY_TRACK_LIFT + trackHeight / 2 - thumbSize / 2 }) }]}
        />
      ) : null}
      {isScrubbing ? (
        <View pointerEvents="none" style={[styles.bubble, { left: bubbleLeft, bottom: touchHeight + 8 }]}>
          <Text size={13} weight={600} lineHeight={16} color={colors.white} align="center">
            {timeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: "flex-end" },
  centered: { justifyContent: "center" },
  bottomAligned: { justifyContent: "flex-end", paddingBottom: OVERLAY_TRACK_LIFT },
  track: { width: "100%", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.28)" },
  edgeTrack: { borderRadius: 0 },
  buffered: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,255,255,0.45)" },
  played: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: colors.white },
  thumb: { position: "absolute", backgroundColor: colors.white, shadowColor: colors.black, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  bubble: { position: "absolute", width: BUBBLE_WIDTH, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.72)" },
});
