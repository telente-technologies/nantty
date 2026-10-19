"use client";

import { type VoiceNotePlaybackRate, createExclusivePlaybackCoordinator, nextVoiceNotePlaybackRate } from "@zudomart/chat-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

export const voiceNotePlaybackCoordinator = createExclusivePlaybackCoordinator();

const finiteOrZero = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function useVoiceNotePlayer(playerId: string, source: string | null, knownDurationSeconds: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [reportedDuration, setReportedDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<VoiceNotePlaybackRate>(1);
  const durationSeconds = finiteOrZero(knownDurationSeconds) || reportedDuration;

  useEffect(() => {
    if (!source) return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = source;
    audioRef.current = audio;
    let frame = 0;
    const followPlayback = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused) frame = requestAnimationFrame(followPlayback);
    };
    const onPlay = () => {
      setIsPlaying(true);
      frame = requestAnimationFrame(followPlayback);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(frame);
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      audio.currentTime = 0;
      setCurrentTime(0);
      voiceNotePlaybackCoordinator.release(playerId);
    };
    const onMetadata = () => setReportedDuration(finiteOrZero(audio.duration));
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("durationchange", onMetadata);
    return () => {
      cancelAnimationFrame(frame);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      voiceNotePlaybackCoordinator.release(playerId);
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [playerId, source]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    voiceNotePlaybackCoordinator.claim(playerId, () => audio.pause());
    audio.playbackRate = playbackRate;
    audio.play().catch(() => setIsPlaying(false));
  }, [playbackRate, playerId]);

  const seekToFraction = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || durationSeconds <= 0) return;
    audio.currentTime = fraction * durationSeconds;
    setCurrentTime(audio.currentTime);
  }, [durationSeconds]);

  const cyclePlaybackRate = useCallback(() => {
    const next = nextVoiceNotePlaybackRate(playbackRate);
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [playbackRate]);

  return {
    isReady: !!source,
    isPlaying,
    currentTime,
    durationSeconds,
    hasStarted: isPlaying || currentTime > 0,
    playedFraction: durationSeconds > 0 ? Math.min(1, currentTime / durationSeconds) : 0,
    playbackRate,
    play,
    pause: () => audioRef.current?.pause(),
    toggle: () => (isPlaying ? audioRef.current?.pause() : play()),
    seekToFraction,
    cyclePlaybackRate,
  };
}
