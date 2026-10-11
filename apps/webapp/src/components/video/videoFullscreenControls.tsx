"use client";

import { ExitFullscreenIcon, PauseIcon, PlayIcon, SkipAheadIcon, SkipBackIcon, SpeakerHighIcon, SpeakerMutedIcon } from "@/components/ui/icons";
import { JUMP_SEEK_SECONDS, formatPlaybackTime, isScrubbableDuration } from "@/utils/videoSeek.util";

import type { VideoPlaybackState } from "./videoPlayback.hook";
import { VideoSeekBar } from "./videoSeekBar";
import styles from "./video.module.css";

export interface VideoFullscreenControlsProps {
  readonly playback: VideoPlaybackState;
  readonly isPaused: boolean;
  readonly isVisible: boolean;
  readonly canSeek: boolean;
  readonly onTogglePlay: () => void;
  readonly onSeekBy: (deltaSeconds: number) => void;
  readonly onScrubStart: () => void;
  readonly onScrubPreview: (seconds: number) => void;
  readonly onScrubEnd: (targetSeconds: number | null) => void;
  readonly onToggleMute: () => void;
  readonly onExit: () => void;
}

export function VideoFullscreenControls(props: VideoFullscreenControlsProps) {
  const { playback } = props;
  const showSkips = props.canSeek && isScrubbableDuration(playback.durationSeconds);
  return (
    <div className={[styles.fullscreenControls, props.isVisible ? "" : styles.fullscreenControlsHidden].join(" ")} onClick={(event) => event.stopPropagation()}>
      <div className={styles.fullscreenCenter}>
        {showSkips ? (
          <button type="button" className={styles.roundButton} aria-label={`Skip back ${JUMP_SEEK_SECONDS} seconds`} title="Back 10s (J)" onClick={() => props.onSeekBy(-JUMP_SEEK_SECONDS)}>
            <SkipBackIcon size={28} />
            <span className={styles.skipCount}>{JUMP_SEEK_SECONDS}</span>
          </button>
        ) : null}
        <button type="button" className={[styles.roundButton, styles.roundButtonLarge].join(" ")} aria-label={props.isPaused ? "Play" : "Pause"} title={props.isPaused ? "Play (K)" : "Pause (K)"} onClick={props.onTogglePlay}>
          {props.isPaused ? <PlayIcon size={32} /> : <PauseIcon size={32} />}
        </button>
        {showSkips ? (
          <button type="button" className={styles.roundButton} aria-label={`Skip ahead ${JUMP_SEEK_SECONDS} seconds`} title="Ahead 10s (L)" onClick={() => props.onSeekBy(JUMP_SEEK_SECONDS)}>
            <SkipAheadIcon size={28} />
            <span className={styles.skipCount}>{JUMP_SEEK_SECONDS}</span>
          </button>
        ) : null}
      </div>
      <div className={styles.fullscreenBottom}>
        <VideoSeekBar
          variant="fullscreen"
          currentSeconds={playback.currentSeconds}
          durationSeconds={playback.durationSeconds}
          bufferedSeconds={playback.bufferedSeconds}
          canSeek={props.canSeek}
          onScrubStart={props.onScrubStart}
          onScrubPreview={props.onScrubPreview}
          onScrubEnd={props.onScrubEnd}
          onSeekBy={props.onSeekBy}
        />
        <div className={styles.fullscreenRow}>
          <span className={styles.timeLabel}>
            {formatPlaybackTime(playback.currentSeconds)} / {formatPlaybackTime(playback.durationSeconds)}
          </span>
          <span className={styles.fullscreenActions}>
            <button type="button" className={styles.iconButton} aria-pressed={playback.isMuted} aria-label={playback.isMuted ? "Unmute" : "Mute"} title={playback.isMuted ? "Unmute" : "Mute"} onClick={props.onToggleMute}>
              {playback.isMuted ? <SpeakerMutedIcon size={22} /> : <SpeakerHighIcon size={22} />}
            </button>
            <button type="button" className={styles.iconButton} aria-label="Exit full screen" title="Exit full screen" onClick={props.onExit}>
              <ExitFullscreenIcon size={22} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
