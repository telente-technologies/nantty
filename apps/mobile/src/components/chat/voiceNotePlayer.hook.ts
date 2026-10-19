import { type VoiceNotePlaybackRate, createExclusivePlaybackCoordinator, nextVoiceNotePlaybackRate } from "@zudomart/chat-crypto";
import { type AudioPlayer, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const voiceNotePlaybackCoordinator = createExclusivePlaybackCoordinator();

export interface PlayableVoiceNoteSource {
  readonly uri: string;
  readonly release: (() => void) | null;
}

export const isPlayableVoiceNoteUri = (uri: unknown): uri is string => typeof uri === "string" && uri.trim().length > 0;

export function useVoiceNotePlayer(playerId: string, knownDurationSeconds: number) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playbackRate, setPlaybackRate] = useState<VoiceNotePlaybackRate>(1);
  const loaded = useRef<{ readonly key: string; readonly release: (() => void) | null } | null>(null);
  const isNativePlayerReleased = useRef(false);
  const durationSeconds = knownDurationSeconds || status.duration || 0;

  const withLivePlayer = useCallback((action: (livePlayer: AudioPlayer) => void): boolean => {
    if (isNativePlayerReleased.current) return false;
    try {
      action(player);
      return true;
    } catch {
      return false;
    }
  }, [player]);

  const pausePlayer = useCallback(() => {
    withLivePlayer((livePlayer) => livePlayer.pause());
  }, [withLivePlayer]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    withLivePlayer((livePlayer) => {
      livePlayer.pause();
      livePlayer.seekTo(0).catch(() => undefined);
    });
    voiceNotePlaybackCoordinator.release(playerId, pausePlayer);
  }, [pausePlayer, playerId, status.didJustFinish, withLivePlayer]);

  const unload = useCallback(() => {
    voiceNotePlaybackCoordinator.release(playerId, pausePlayer);
    const current = loaded.current;
    if (!current) return;
    loaded.current = null;
    pausePlayer();
    current.release?.();
  }, [pausePlayer, playerId]);

  useLayoutEffect(() => {
    isNativePlayerReleased.current = false;
    return () => {
      unload();
      isNativePlayerReleased.current = true;
    };
  }, [unload]);

  const ensureLoaded = (key: string, resolveSource: () => PlayableVoiceNoteSource | null) => {
    if (isNativePlayerReleased.current) return false;
    if (loaded.current?.key === key) return true;
    unload();
    const source = resolveSource();
    if (!source) return false;
    if (!isPlayableVoiceNoteUri(source.uri) || !withLivePlayer((livePlayer) => livePlayer.replace({ uri: source.uri }))) {
      source.release?.();
      return false;
    }
    loaded.current = { key, release: source.release };
    return true;
  };

  const play = (key: string, resolveSource: () => PlayableVoiceNoteSource | null) => {
    if (!ensureLoaded(key, resolveSource)) return;
    voiceNotePlaybackCoordinator.claim(playerId, pausePlayer);
    withLivePlayer((livePlayer) => {
      livePlayer.setPlaybackRate(playbackRate);
      livePlayer.play();
    });
  };

  const seekToFraction = (key: string, resolveSource: () => PlayableVoiceNoteSource | null, fraction: number) => {
    if (durationSeconds <= 0 || !ensureLoaded(key, resolveSource)) return;
    withLivePlayer((livePlayer) => {
      livePlayer.seekTo(fraction * durationSeconds).catch(() => undefined);
    });
  };

  const cyclePlaybackRate = () => {
    const next = nextVoiceNotePlaybackRate(playbackRate);
    setPlaybackRate(next);
    withLivePlayer((livePlayer) => livePlayer.setPlaybackRate(next));
  };

  return {
    isPlaying: status.playing,
    currentTime: status.currentTime,
    durationSeconds,
    playedFraction: durationSeconds > 0 ? Math.min(1, status.currentTime / durationSeconds) : 0,
    hasStarted: status.playing || status.currentTime > 0,
    playbackRate,
    play,
    pause: pausePlayer,
    seekToFraction,
    cyclePlaybackRate,
    unload,
  };
}
