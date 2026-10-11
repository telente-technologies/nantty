import { useState, type ReactNode, type RefObject } from "react";
import { StyleSheet } from "react-native";

import { ClipVideoPlayer, VideoPosterOnly, type VideoPlaybackController, type VideoPlaybackProgress } from "@/components/media/clipVideoPlayer";
import { VideoSeekBar } from "@/components/media/videoSeekBar";
import type { Media } from "@/types";

export interface FeedVideoPageProps {
  readonly media: Media;
  readonly isActive: boolean;
  readonly isMuted: boolean;
  readonly shouldMountPlayer: boolean;
  readonly controllerRef?: RefObject<VideoPlaybackController | null>;
  readonly onPlaybackProgress: (progress: VideoPlaybackProgress) => void;
  readonly children?: ReactNode;
}

export function FeedVideoPage({ media, isActive, isMuted, shouldMountPlayer, controllerRef, onPlaybackProgress, children }: FeedVideoPageProps) {
  const [progress, setProgress] = useState<VideoPlaybackProgress>({ currentSeconds: 0, durationSeconds: media.durationSeconds ?? 0 });
  const [isScrubbing, setIsScrubbing] = useState(false);
  const trackProgress = (next: VideoPlaybackProgress) => {
    setProgress(next);
    onPlaybackProgress(next);
  };
  const durationSeconds = progress.durationSeconds || media.durationSeconds || 0;

  if (!shouldMountPlayer) {
    return (
      <>
        <VideoPosterOnly media={media} style={StyleSheet.absoluteFill} />
        {children}
      </>
    );
  }
  return (
    <>
      <ClipVideoPlayer
        media={media}
        isActive={isActive}
        isMuted={isMuted}
        isPausedByUser={isScrubbing}
        controllerRef={controllerRef}
        onPlaybackProgress={isActive ? trackProgress : undefined}
        style={StyleSheet.absoluteFill}
      />
      {children}
      {isActive ? (
        <VideoSeekBar
          currentSeconds={progress.currentSeconds}
          durationSeconds={durationSeconds}
          bufferedSeconds={progress.bufferedSeconds}
          onScrubStart={() => setIsScrubbing(true)}
          onScrubEnd={(targetSeconds) => {
            setIsScrubbing(false);
            if (targetSeconds !== null) controllerRef?.current?.seekTo(targetSeconds);
          }}
          onSeekBy={(deltaSeconds) => controllerRef?.current?.seekBy(deltaSeconds)}
          style={styles.seekBar}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  seekBar: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
