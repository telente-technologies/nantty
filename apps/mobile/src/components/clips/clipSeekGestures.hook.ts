import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { VideoPlaybackController } from "@/components/media/clipVideoPlayer";
import { DOUBLE_TAP_WINDOW_MS, SEEK_STREAK_WINDOW_MS, createTapGestureState, doubleTapZoneAt, resolveTap } from "@/utils/videoSeek.util";

import type { SeekRippleState } from "./seekRipple";

export interface ClipSeekGesturesOptions {
  readonly isActive: boolean;
  readonly canSeek: boolean;
  readonly pageWidth: number;
  readonly onSingleTap: () => void;
  readonly onDoubleTapLike: () => void;
  readonly onSeeked: (targetSeconds: number) => void;
}

export function useClipSeekGestures({ isActive, canSeek, pageWidth, onSingleTap, onDoubleTapLike, onSeeked }: ClipSeekGesturesOptions) {
  const controllerRef = useRef<VideoPlaybackController | null>(null);
  const tapState = useRef(createTapGestureState());
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekRipple, setSeekRipple] = useState<SeekRippleState | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const clearTimers = () => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    singleTapTimer.current = null;
    rippleTimer.current = null;
  };

  useEffect(() => {
    if (isActive) return;
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = null;
    tapState.current = createTapGestureState();
  }, [isActive]);

  useEffect(() => clearTimers, []);

  const seekTo = (seconds: number) => {
    const controller = controllerRef.current;
    if (controller) onSeeked(controller.seekTo(seconds));
  };

  const seekBy = (deltaSeconds: number) => {
    const controller = controllerRef.current;
    if (controller) onSeeked(controller.seekBy(deltaSeconds));
  };

  const handleTap = (locationX: number) => {
    const zone = doubleTapZoneAt(locationX, pageWidth, canSeek && controllerRef.current !== null);
    const { state, outcome } = resolveTap(tapState.current, zone, Date.now());
    tapState.current = state;
    if (outcome.kind === "pending") {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        onSingleTap();
      }, DOUBLE_TAP_WINDOW_MS);
      return;
    }
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = null;
    if (outcome.kind === "like") {
      onDoubleTapLike();
      return;
    }
    seekBy(outcome.deltaSeconds);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setSeekRipple((previous) => ({ zone: outcome.zone, seconds: outcome.streakSeconds, tapKey: (previous?.tapKey ?? 0) + 1 }));
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    rippleTimer.current = setTimeout(() => setSeekRipple(null), SEEK_STREAK_WINDOW_MS);
  };

  const scrubHandlers = {
    onScrubStart: () => setIsScrubbing(true),
    onScrubEnd: (targetSeconds: number | null) => {
      setIsScrubbing(false);
      if (targetSeconds !== null) seekTo(targetSeconds);
    },
  };

  return { controllerRef, handleTap, seekBy, seekTo, seekRipple, isScrubbing, scrubHandlers };
}
