"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import {
  EnterFullscreenIcon,
  EyeIcon,
  LikeActionIcon,
  LikeFilledActionIcon,
  PlayIcon,
  ReplyActionIcon,
  ShareActionIcon,
  SpeakerHighIcon,
  SpeakerMutedIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { usePostNotificationMute } from "@/components/feed/postNotificationMute.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { canOfferPostNotificationMute } from "@/utils/postNotificationMute.util";
import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { Avatar, MediaImage } from "@/components/ui/media";
import { formatCompactCount } from "@/utils/formatCount.util";
import { ClipTaggedPill } from "@/components/taggedPeople/clipTaggedPill";
import type { Clip } from "@/types";

import styles from "./page.module.css";
import { IconLabel } from "@/components/ui/appIcon";
import { findDownloadTargetForPost } from "@/utils/brandedDownload.util";
import { describeCount } from "@/utils/countLabel.util";
import { ViewsExplainerDialog } from "@/components/feed/viewsExplainerDialog";
import { feedInteractionsService } from "@/services/feedInteractions.service";

import { useClipWatchTracking } from "./clipWatchTracking.hook";
import { useVideoControls } from "@/components/video/videoControls.hook";
import { VideoFullscreenControls } from "@/components/video/videoFullscreenControls";
import { useDocumentVideoShortcuts } from "@/components/video/videoPlayback.hook";
import { VideoSeekBar } from "@/components/video/videoSeekBar";

function canPlayInBrowser(url: string | null): url is string {
  return !!url && !url.endsWith(".m3u8");
}

const DOUBLE_TAP_WINDOW_MS = 280;

export interface ClipEngagement {
  readonly liked: boolean;
  readonly likes: number;
  readonly isFollowing: boolean;
}

interface ClipPlayerCardProps {
  readonly clip: Clip;
  readonly isActive: boolean;
  readonly isMuted: boolean;
  readonly engagement: ClipEngagement;
  readonly shareCount: number;
  readonly onToggleMute: () => void;
  readonly onToggleLike: () => void;
  readonly onLikeByDoubleTap: () => void;
  readonly onToggleFollow: () => void;
  readonly onOpenComments: () => void;
  readonly onShareLink: () => void;
}

export function ClipPlayerCard({
  clip,
  isActive,
  isMuted,
  engagement,
  shareCount,
  onToggleMute,
  onToggleLike,
  onLikeByDoubleTap,
  onToggleFollow,
  onOpenComments,
  onShareLink,
}: ClipPlayerCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { viewer } = useSession();
  const notificationMute = usePostNotificationMute(clip);
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPausedByViewer, setIsPausedByViewer] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [isTaggedOpen, setIsTaggedOpen] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isViewsInfoOpen, setIsViewsInfoOpen] = useState(false);
  const isOwnClip = viewer?.id === clip.author.id;
  const { confirmAndDelete } = useDeleteOwnPost();
  const interactionTarget = useMemo(() => ({ postId: clip.id, authorId: clip.author.id }), [clip.id, clip.author.id]);
  useClipWatchTracking(videoRef, interactionTarget, isActive, clip.durationSeconds ?? 0);
  const media = clip.media[0];
  const isLandscapeClip = !!media?.width && !!media.height && media.width > media.height;
  const playableUrl = canPlayInBrowser(media?.url ?? null) ? (media as { url: string }).url : null;
  const canSeek = !clip.sponsored && !clip.promotedLive;
  const togglePausedByViewer = useCallback(() => setIsPausedByViewer((paused) => !paused), []);
  const controls = useVideoControls({ videoRef, containerRef: stageRef, sourceKey: playableUrl, fallbackDurationSeconds: clip.durationSeconds ?? 0, onTogglePlay: togglePausedByViewer, onToggleMute });
  const { fullscreen } = controls;
  const ignoreSeek = useCallback(() => undefined, []);
  useDocumentVideoShortcuts(isActive && !!playableUrl, { onSeekBy: canSeek ? controls.seekBy : ignoreSeek, onTogglePlay: controls.togglePlay });
  const captionNeedsToggle = clip.text.length > 140;
  const visibleCaption = !captionNeedsToggle || isCaptionExpanded ? clip.text : `${clip.text.slice(0, 140).trimEnd()}…`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !isPausedByViewer && !isTaggedOpen) {
      video.muted = isMuted;
      void video.play().catch(() => setIsPausedByViewer(true));
    } else {
      video.pause();
    }
  }, [isActive, isPausedByViewer, isTaggedOpen, isMuted]);

  useEffect(() => {
    if (!isActive) {
      setIsPausedByViewer(false);
      setIsCaptionExpanded(false);
    }
  }, [isActive]);

  useEffect(() => () => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
  }, []);

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTapAt.current = 0;
      setBurstKey((key) => key + 1);
      onLikeByDoubleTap();
      return;
    }
    lastTapAt.current = now;
    singleTapTimer.current = setTimeout(() => {
      setIsPausedByViewer((paused) => !paused);
    }, DOUBLE_TAP_WINDOW_MS);
  }

  return (
    <article className={styles.clip} data-clip-id={clip.id} aria-label={`Clip by ${clip.author.name}`}>
      <div ref={stageRef} className={[styles.stage, fullscreen.isFullscreen ? styles.stageFullscreen : ""].join(" ")} onPointerMove={fullscreen.isFullscreen ? controls.wakeControls : undefined}>
        {playableUrl ? (
          <video
            ref={videoRef}
            className={[styles.video, isLandscapeClip ? styles.videoLandscape : ""].join(" ")}
            src={playableUrl}
            poster={media?.posterUrl ?? undefined}
            loop
            muted={isMuted}
            playsInline
            preload={isActive ? "auto" : "metadata"}
            onClick={fullscreen.isFullscreen ? controls.toggleControls : handleMediaTap}
          />
        ) : (
          <MediaImage src={media?.posterUrl ?? null} alt="" sizes="420px" />
        )}
        {burstKey > 0 ? (
          <span key={burstKey} className={styles.likeBurst} aria-hidden="true">
            <LikeFilledActionIcon size={72} />
          </span>
        ) : null}
        {playableUrl && isPausedByViewer && !fullscreen.isFullscreen && !controls.isScrubbing ? (
          <button
            type="button"
            className={styles.playToggle}
            aria-label="Play clip"
            onClick={() => setIsPausedByViewer(false)}
          >
            <PlayIcon size={34} />
          </button>
        ) : null}
        {fullscreen.isFullscreen ? null : (
        <>
        <button
          type="button"
          className={styles.muteButton}
          aria-pressed={isMuted}
          aria-label={isMuted ? "Unmute clips" : "Mute clips"}
          title={isMuted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
        >
          {isMuted ? <SpeakerMutedIcon size={18} /> : <SpeakerHighIcon size={18} />}
        </button>
        {playableUrl ? (
          <button type="button" className={styles.fullscreenButton} aria-label="Full screen" title="Full screen" onClick={fullscreen.enter}>
            <EnterFullscreenIcon size={18} />
          </button>
        ) : null}
        <div className={styles.overlay}>
          <div className={styles.authorRow}>
            <Link href={`/user/${clip.author.id}`} className={styles.clipAuthor} onClick={() => feedInteractionsService.recordProfileClick(interactionTarget, "clips")}>
              <Avatar name={clip.author.name} src={clip.author.avatarUrl} size="sm" />
              <span className={styles.authorNames}>
                <span className={styles.authorName}>{clip.author.name}</span>
                <span className={styles.authorHandle}>@{clip.author.username}</span>
              </span>
            </Link>
            {!engagement.isFollowing && viewer?.id !== clip.author.id ? (
              <button type="button" className={styles.followPill} onClick={() => {
                feedInteractionsService.recordFollow(interactionTarget, "clips");
                onToggleFollow();
              }}>
                Follow
              </button>
            ) : null}
          </div>
          <ClipTaggedPill post={clip} isOpen={isTaggedOpen} onOpenChange={setIsTaggedOpen} />
          <p className={[styles.clipCaption, isCaptionExpanded ? styles.clipCaptionExpanded : ""].join(" ")}>
            {visibleCaption}{" "}
            {captionNeedsToggle ? (
              <button type="button" className={styles.captionToggle} onClick={() => setIsCaptionExpanded((expanded) => !expanded)}>
                {isCaptionExpanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </p>
          <p className={styles.clipSound}>
            <IconLabel name="musicNotes24" size={14}>
              {clip.sound.title}
            </IconLabel>
          </p>
          {clip.products[0] ? (
            <Link href={`/product/${clip.products[0].id}`} className={styles.productChip}>
              Shop: {clip.products[0].name}
            </Link>
          ) : null}
        </div>
        </>
        )}
        {playableUrl && !fullscreen.isFullscreen && !clip.promotedLive ? (
          <VideoSeekBar
            className={styles.clipSeekBar}
            currentSeconds={controls.playback.currentSeconds}
            durationSeconds={controls.playback.durationSeconds}
            bufferedSeconds={controls.playback.bufferedSeconds}
            canSeek={canSeek && isActive}
            onScrubStart={controls.scrub.onScrubStart}
            onScrubPreview={controls.scrub.onScrubPreview}
            onScrubEnd={controls.scrub.onScrubEnd}
            onSeekBy={controls.seekBy}
          />
        ) : null}
        {playableUrl && fullscreen.isFullscreen ? (
          <VideoFullscreenControls
            playback={controls.playback}
            isPaused={isPausedByViewer}
            isVisible={controls.areControlsVisible}
            canSeek={canSeek}
            onTogglePlay={controls.togglePlay}
            onSeekBy={controls.seekBy}
            onScrubStart={controls.scrub.onScrubStart}
            onScrubPreview={controls.scrub.onScrubPreview}
            onScrubEnd={controls.scrub.onScrubEnd}
            onToggleMute={controls.toggleMute}
            onExit={fullscreen.exit}
          />
        ) : null}
      </div>
      <div className={styles.actionColumn} role="group" aria-label="Clip actions">
        <span className={styles.actionItem}>
          <button
            type="button"
            className={[styles.actionCircle, engagement.liked ? styles.actionCircleActive : ""].join(" ")}
            aria-pressed={engagement.liked}
            aria-label={`Like, ${describeCount(engagement.likes, "like", "likes")}`}
            title={engagement.liked ? "Unlike" : "Like"}
            onClick={onToggleLike}
          >
            {engagement.liked ? <LikeFilledActionIcon size={24} /> : <LikeActionIcon size={24} />}
          </button>
          <span className={styles.actionCount}>{formatCompactCount(engagement.likes)}</span>
        </span>
        <span className={styles.actionItem}>
          <button
            type="button"
            className={styles.actionCircle}
            aria-label={`Comments, ${clip.comments}`}
            title="Comments"
            onClick={() => requireAuthThen(onOpenComments, "Sign in to join the conversation.")}
          >
            <ReplyActionIcon size={24} />
          </button>
          <span className={styles.actionCount}>{formatCompactCount(clip.comments)}</span>
        </span>
        <span className={styles.actionItem}>
          <button
            type="button"
            className={styles.actionCircle}
            aria-label={`Share clip, ${describeCount(shareCount, "share", "shares")}`}
            title="Copy link"
            onClick={onShareLink}
          >
            <ShareActionIcon size={24} />
          </button>
          <span className={styles.actionCount}>{formatCompactCount(shareCount)}</span>
        </span>
        <span className={styles.actionItem}>
          <ShareToChatButton kind="clip" referenceId={clip.id} className={styles.actionCircle} iconOnly />
          <span className={styles.actionCount}>Chat</span>
        </span>
        <span className={styles.actionItem}>
          <SaveToggleButton targetType="clip" targetId={clip.id} initiallySaved={clip.bookmarked} appearance="overlay" iconSize={24} />
          <span className={styles.actionCount}>{formatCompactCount(clip.saveCount ?? 0)}</span>
        </span>
        <span className={styles.actionItem}>
          {isOwnClip ? (
            <Link href={`/analytics/post/${clip.id}`} className={styles.actionCircle} aria-label={`View clip analytics, ${describeCount(clip.views, "view", "views")}`} title="Clip analytics">
              <EyeIcon size={24} />
            </Link>
          ) : (
            <button type="button" className={styles.actionCircle} aria-haspopup="dialog" aria-label={`Views, ${describeCount(clip.views, "view", "views")}. What are views`} title="Views" onClick={() => setIsViewsInfoOpen(true)}>
              <EyeIcon size={24} />
            </button>
          )}
          <span className={styles.actionCount}>{formatCompactCount(clip.views)}</span>
        </span>
        <span className={styles.actionItem}>
          <ContentActionsMenu
            shareKind={null}
            reportTargetType="clip"
            targetId={clip.id}
            soundId={clip.sound?.id ?? null}
            canonicalPath={`/clips?start=${clip.id}`}
            triggerClassName={styles.actionCircle}
            downloadTarget={findDownloadTargetForPost(clip)}
            notificationMuteAction={canOfferPostNotificationMute(viewer !== null, clip) ? { isMuted: notificationMute.isMuted, onToggle: notificationMute.toggle } : undefined}
            isOwnContent={isOwnClip}
            extraDangerActions={isOwnClip ? [{ label: "Delete", icon: <TrashIcon size={18} aria-hidden="true" />, onSelect: () => void confirmAndDelete({ id: clip.id, kind: "clip" }) }] : undefined}
          />
        </span>
      </div>
      <ViewsExplainerDialog isOpen={isViewsInfoOpen} onClose={() => setIsViewsInfoOpen(false)} />
    </article>
  );
}
