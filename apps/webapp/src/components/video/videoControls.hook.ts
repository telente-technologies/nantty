"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { seekVideoBy, seekVideoTo, useElementFullscreen, useVideoPlaybackState } from "./videoPlayback.hook";

const CONTROLS_AUTO_HIDE_MS = 3000;

export interface VideoControlsOptions {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly sourceKey: string | null;
  readonly fallbackDurationSeconds?: number;
  readonly onTogglePlay?: () => void;
  readonly onToggleMute?: () => void;
}

export function useVideoControls({ videoRef, containerRef, sourceKey, fallbackDurationSeconds = 0, onTogglePlay, onToggleMute }: VideoControlsOptions) {
  const playback = useVideoPlaybackState(videoRef, sourceKey, fallbackDurationSeconds);
  const fullscreen = useElementFullscreen(containerRef);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [lastWakeAt, setLastWakeAt] = useState(0);
  const wasPlayingBeforeScrub = useRef(false);
  const secondsBeforeScrub = useRef(0);

  useEffect(() => {
    if (!fullscreen.isFullscreen || !areControlsVisible || playback.isPaused || isScrubbing) return;
    const timer = window.setTimeout(() => setAreControlsVisible(false), CONTROLS_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [fullscreen.isFullscreen, areControlsVisible, playback.isPaused, isScrubbing, lastWakeAt]);

  const wakeControls = useCallback(() => {
    setAreControlsVisible(true);
    setLastWakeAt(Date.now());
  }, []);

  const togglePlay = useCallback(() => {
    wakeControls();
    if (onTogglePlay) {
      onTogglePlay();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, [onTogglePlay, videoRef, wakeControls]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      wakeControls();
      seekVideoBy(videoRef.current, deltaSeconds);
    },
    [videoRef, wakeControls],
  );

  const toggleMute = useCallback(() => {
    wakeControls();
    if (onToggleMute) {
      onToggleMute();
      return;
    }
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, [onToggleMute, videoRef, wakeControls]);

  const scrub = {
    onScrubStart: () => {
      const video = videoRef.current;
      wasPlayingBeforeScrub.current = !!video && !video.paused;
      secondsBeforeScrub.current = video?.currentTime ?? 0;
      video?.pause();
      setIsScrubbing(true);
    },
    onScrubPreview: (seconds: number) => seekVideoTo(videoRef.current, seconds),
    onScrubEnd: (targetSeconds: number | null) => {
      const video = videoRef.current;
      seekVideoTo(video, targetSeconds ?? secondsBeforeScrub.current);
      setIsScrubbing(false);
      wakeControls();
      if (wasPlayingBeforeScrub.current) void video?.play().catch(() => undefined);
      wasPlayingBeforeScrub.current = false;
    },
  };

  return {
    playback,
    fullscreen,
    isScrubbing,
    areControlsVisible: areControlsVisible || !fullscreen.isFullscreen,
    toggleControls: () => (areControlsVisible ? setAreControlsVisible(false) : wakeControls()),
    wakeControls,
    togglePlay,
    seekBy,
    toggleMute,
    scrub,
  };
}
