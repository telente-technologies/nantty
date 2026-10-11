"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

import { bufferedEndAround, clampSeekSeconds, videoShortcutFor } from "@/utils/videoSeek.util";

export interface VideoPlaybackState {
  readonly currentSeconds: number;
  readonly durationSeconds: number;
  readonly bufferedSeconds: number;
  readonly isPaused: boolean;
  readonly isMuted: boolean;
}

const INITIAL_STATE: VideoPlaybackState = { currentSeconds: 0, durationSeconds: 0, bufferedSeconds: 0, isPaused: true, isMuted: false };
const PLAYBACK_EVENTS = ["timeupdate", "durationchange", "loadedmetadata", "progress", "play", "pause", "volumechange", "seeking", "emptied"] as const;

function readPlaybackState(video: HTMLVideoElement, fallbackDurationSeconds: number): VideoPlaybackState {
  const ranges: [number, number][] = [];
  for (let index = 0; index < video.buffered.length; index += 1) ranges.push([video.buffered.start(index), video.buffered.end(index)]);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallbackDurationSeconds;
  return {
    currentSeconds: video.currentTime,
    durationSeconds: duration,
    bufferedSeconds: bufferedEndAround(ranges, video.currentTime),
    isPaused: video.paused,
    isMuted: video.muted,
  };
}

export function useVideoPlaybackState(videoRef: RefObject<HTMLVideoElement | null>, sourceKey: string | null, fallbackDurationSeconds = 0): VideoPlaybackState {
  const [state, setState] = useState<VideoPlaybackState>({ ...INITIAL_STATE, durationSeconds: fallbackDurationSeconds });
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => setState(readPlaybackState(video, fallbackDurationSeconds));
    for (const name of PLAYBACK_EVENTS) video.addEventListener(name, sync);
    sync();
    return () => {
      for (const name of PLAYBACK_EVENTS) video.removeEventListener(name, sync);
    };
  }, [videoRef, sourceKey, fallbackDurationSeconds]);
  return state;
}

export const USER_SEEK_FLAG = "userSeek";

export function seekVideoTo(video: HTMLVideoElement | null, seconds: number): void {
  if (!video) return;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  video.dataset[USER_SEEK_FLAG] = "true";
  video.currentTime = clampSeekSeconds(seconds, duration);
}

export function consumeUserSeekFlag(video: HTMLVideoElement): boolean {
  const wasUserSeek = video.dataset[USER_SEEK_FLAG] === "true";
  delete video.dataset[USER_SEEK_FLAG];
  return wasUserSeek;
}

export const seekVideoBy = (video: HTMLVideoElement | null, deltaSeconds: number) => seekVideoTo(video, (video?.currentTime ?? 0) + deltaSeconds);

function isTypingOrControlTarget(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest("input, textarea, select")) return true;
  return key === " " && target.closest("button, a, [role='button']") !== null;
}

export interface VideoShortcutHandlers {
  readonly onSeekBy: (deltaSeconds: number) => void;
  readonly onTogglePlay: () => void;
}

export function handleVideoShortcutKey(event: Pick<KeyboardEvent, "key" | "target" | "defaultPrevented" | "altKey" | "ctrlKey" | "metaKey" | "preventDefault">, handlers: VideoShortcutHandlers): boolean {
  if (event.defaultPrevented || isTypingOrControlTarget(event.target, event.key)) return false;
  const shortcut = videoShortcutFor(event.key, event.altKey || event.ctrlKey || event.metaKey);
  if (!shortcut) return false;
  event.preventDefault();
  if (shortcut.kind === "togglePlay") handlers.onTogglePlay();
  else handlers.onSeekBy(shortcut.deltaSeconds);
  return true;
}

export function useDocumentVideoShortcuts(enabled: boolean, handlers: VideoShortcutHandlers): void {
  const { onSeekBy, onTogglePlay } = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      handleVideoShortcutKey(event, { onSeekBy, onTogglePlay });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onSeekBy, onTogglePlay]);
}

export function useElementFullscreen(elementRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null && document.fullscreenElement === elementRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [elementRef]);
  const enter = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;
    if (typeof element.requestFullscreen === "function") {
      void element.requestFullscreen().catch(() => undefined);
      return;
    }
    const video = element.querySelector("video") as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    video?.webkitEnterFullscreen?.();
  }, [elementRef]);
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);
  return { isFullscreen, enter, exit };
}
