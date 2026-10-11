"use client";

import { useRef, type KeyboardEvent } from "react";

import { EnterFullscreenIcon, PlayIcon, SpeakerHighIcon, SpeakerMutedIcon } from "@/components/ui/icons";

import { useVideoControls } from "./videoControls.hook";
import { VideoFullscreenControls } from "./videoFullscreenControls";
import { handleVideoShortcutKey, useDocumentVideoShortcuts } from "./videoPlayback.hook";
import { VideoSeekBar } from "./videoSeekBar";
import styles from "./video.module.css";

export interface InlineVideoPlayerProps {
  readonly src: string;
  readonly poster?: string | null;
  readonly durationSeconds?: number | null;
  readonly className?: string;
  readonly videoClassName?: string;
  readonly label?: string;
  readonly documentShortcuts?: boolean;
}

export function InlineVideoPlayer({ src, poster, durationSeconds, className, videoClassName, label = "Video", documentShortcuts = false }: InlineVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controls = useVideoControls({ videoRef, containerRef, sourceKey: src, fallbackDurationSeconds: durationSeconds ?? 0 });
  const { playback, fullscreen } = controls;
  const shortcutHandlers = { onSeekBy: controls.seekBy, onTogglePlay: controls.togglePlay };
  useDocumentVideoShortcuts(documentShortcuts || fullscreen.isFullscreen, shortcutHandlers);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (documentShortcuts || fullscreen.isFullscreen) return;
    handleVideoShortcutKey(event.nativeEvent, shortcutHandlers);
  };

  return (
    <div
      ref={containerRef}
      className={[styles.player, fullscreen.isFullscreen ? styles.playerFullscreen : "", className ?? ""].join(" ")}
      role="group"
      aria-label={label}
      tabIndex={documentShortcuts ? undefined : 0}
      onKeyDown={handleKeyDown}
      onPointerMove={fullscreen.isFullscreen ? controls.wakeControls : undefined}
    >
      <video
        ref={videoRef}
        className={[styles.playerVideo, videoClassName ?? ""].join(" ")}
        src={src}
        poster={poster ?? undefined}
        preload="metadata"
        playsInline
        onClick={fullscreen.isFullscreen ? controls.toggleControls : controls.togglePlay}
      />
      {playback.isPaused && !controls.isScrubbing && !fullscreen.isFullscreen ? (
        <button type="button" className={styles.centerPlay} aria-label="Play video" onClick={controls.togglePlay}>
          <PlayIcon size={30} />
        </button>
      ) : null}
      {fullscreen.isFullscreen ? (
        <VideoFullscreenControls
          playback={playback}
          isPaused={playback.isPaused}
          isVisible={controls.areControlsVisible}
          canSeek
          onTogglePlay={controls.togglePlay}
          onSeekBy={controls.seekBy}
          onScrubStart={controls.scrub.onScrubStart}
          onScrubPreview={controls.scrub.onScrubPreview}
          onScrubEnd={controls.scrub.onScrubEnd}
          onToggleMute={controls.toggleMute}
          onExit={fullscreen.exit}
        />
      ) : (
        <>
          <span className={styles.inlineActions}>
            <button type="button" className={styles.iconButton} aria-pressed={playback.isMuted} aria-label={playback.isMuted ? "Unmute" : "Mute"} title={playback.isMuted ? "Unmute" : "Mute"} onClick={controls.toggleMute}>
              {playback.isMuted ? <SpeakerMutedIcon size={18} /> : <SpeakerHighIcon size={18} />}
            </button>
            <button type="button" className={styles.iconButton} aria-label="Full screen" title="Full screen" onClick={fullscreen.enter}>
              <EnterFullscreenIcon size={18} />
            </button>
          </span>
          <VideoSeekBar
            className={styles.bottomSeekBar}
            currentSeconds={playback.currentSeconds}
            durationSeconds={playback.durationSeconds}
            bufferedSeconds={playback.bufferedSeconds}
            onScrubStart={controls.scrub.onScrubStart}
            onScrubPreview={controls.scrub.onScrubPreview}
            onScrubEnd={controls.scrub.onScrubEnd}
            onSeekBy={controls.seekBy}
          />
        </>
      )}
    </div>
  );
}
