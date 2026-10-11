import { useEvent, useEventListener } from "expo";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { makeThemedStyles } from "@/theme";
import type { Media } from "@/types";
import { clampSeekSeconds } from "@/utils/videoSeek.util";

import { buildCachedVideoSourceForMedia, hasPlayableHlsStream } from "./videoSource.util";

export interface VideoPlaybackProgress {
  readonly currentSeconds: number;
  readonly durationSeconds: number;
  readonly bufferedSeconds?: number;
}

export interface VideoPlaybackController {
  seekTo(seconds: number): number;
  seekBy(deltaSeconds: number): number;
  positionSeconds(): number;
}

export interface ClipVideoPlayerProps {
  readonly media: Media;
  readonly isActive: boolean;
  readonly isMuted: boolean;
  readonly isPausedByUser?: boolean;
  readonly loop?: boolean;
  readonly contentFit?: "cover" | "contain";
  readonly style?: StyleProp<ViewStyle>;
  readonly onPlaybackProgress?: (progress: VideoPlaybackProgress) => void;
  readonly onPlaybackFinished?: () => void;
  readonly playbackRate?: number;
  readonly controllerRef?: RefObject<VideoPlaybackController | null>;
  readonly startAtSeconds?: number;
}

export function ClipVideoPlayer({
  media,
  isActive,
  isMuted,
  isPausedByUser = false,
  loop = true,
  contentFit = "cover",
  style,
  onPlaybackProgress,
  onPlaybackFinished,
  playbackRate = 1,
  controllerRef,
  startAtSeconds,
}: ClipVideoPlayerProps) {
  const styles = useStyles();
  const [hasHlsStreamFailed, setHasHlsStreamFailed] = useState(false);
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);
  const isUsingHlsStream = hasPlayableHlsStream(media) && !hasHlsStreamFailed;
  const videoSource = useMemo(() => buildCachedVideoSourceForMedia(media, !hasHlsStreamFailed), [media, hasHlsStreamFailed]);

  const player = useVideoPlayer(videoSource, (createdPlayer) => {
    createdPlayer.loop = loop;
    createdPlayer.muted = isMuted;
    createdPlayer.timeUpdateEventInterval = onPlaybackProgress ? 0.25 : 0;
  });

  const { status } = useEvent(player, "statusChange", { status: player.status });
  const pendingSeekSeconds = useRef<number | null>(startAtSeconds && startAtSeconds > 0 ? startAtSeconds : null);
  const latestOnPlaybackProgress = useRef(onPlaybackProgress);
  useEffect(() => {
    latestOnPlaybackProgress.current = onPlaybackProgress;
  });
  const knownDurationSeconds = () => (player.duration > 0 ? player.duration : (media.durationSeconds ?? 0));

  useImperativeHandle(controllerRef, () => {
    const seekTo = (seconds: number) => {
      const durationSeconds = knownDurationSeconds();
      const target = clampSeekSeconds(seconds, durationSeconds);
      if (player.status === "readyToPlay") player.currentTime = target;
      else pendingSeekSeconds.current = target;
      latestOnPlaybackProgress.current?.({ currentSeconds: target, durationSeconds, bufferedSeconds: player.bufferedPosition });
      return target;
    };
    return {
      seekTo,
      seekBy: (deltaSeconds) => seekTo((pendingSeekSeconds.current ?? player.currentTime) + deltaSeconds),
      positionSeconds: () => pendingSeekSeconds.current ?? player.currentTime,
    };
  });

  useEffect(() => {
    if (status !== "readyToPlay" || pendingSeekSeconds.current === null) return;
    player.currentTime = clampSeekSeconds(pendingSeekSeconds.current, player.duration);
    pendingSeekSeconds.current = null;
  }, [player, status]);

  useEffect(() => {
    if (status === "error" && isUsingHlsStream) setHasHlsStreamFailed(true);
  }, [status, isUsingHlsStream]);

  useEffect(() => {
    player.playbackRate = playbackRate;
  }, [player, playbackRate]);

  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    player.loop = loop;
  }, [player, loop]);

  useEffect(() => {
    if (isActive && !isPausedByUser) player.play();
    else player.pause();
  }, [player, isActive, isPausedByUser, status]);

  useEventListener(player, "timeUpdate", ({ currentTime, bufferedPosition }) => {
    if (pendingSeekSeconds.current !== null) return;
    onPlaybackProgress?.({ currentSeconds: currentTime, durationSeconds: player.duration, bufferedSeconds: bufferedPosition });
  });
  useEventListener(player, "playToEnd", () => onPlaybackFinished?.());

  const posterUrl = media.posterUrl ?? null;
  return (
    <View style={[styles.root, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={false}
        allowsPictureInPicture={false}
        playsInline
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
      />
      {!hasRenderedFirstFrame && posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

export function VideoPosterOnly({ media, contentFit = "cover", style }: Pick<ClipVideoPlayerProps, "media" | "contentFit" | "style">) {
  const styles = useStyles();
  return (
    <View style={[styles.root, style]}>
      {media.posterUrl ? (
        <Image
          source={{ uri: media.posterUrl }}
          placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { overflow: "hidden", backgroundColor: colors.black },
}));
