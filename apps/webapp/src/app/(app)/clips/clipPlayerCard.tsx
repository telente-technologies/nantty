"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import {
  EyeIcon,
  LikeActionIcon,
  LikeFilledActionIcon,
  PlayIcon,
  ReplyActionIcon,
  ShareActionIcon,
  SpeakerHighIcon,
  SpeakerMutedIcon,
} from "@/components/ui/icons";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
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
  const { viewer } = useSession();
  const notificationMute = usePostNotificationMute(clip);
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPausedByViewer, setIsPausedByViewer] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [isTaggedOpen, setIsTaggedOpen] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const media = clip.media[0];
  const isLandscapeClip = !!media?.width && !!media.height && media.width > media.height;
  const playableUrl = canPlayInBrowser(media?.url ?? null) ? (media as { url: string }).url : null;
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
      <div className={styles.stage}>
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
            onClick={handleMediaTap}
          />
        ) : (
          <MediaImage src={media?.posterUrl ?? null} alt="" sizes="420px" />
        )}
        {burstKey > 0 ? (
          <span key={burstKey} className={styles.likeBurst} aria-hidden="true">
            <LikeFilledActionIcon size={72} />
          </span>
        ) : null}
        {playableUrl && isPausedByViewer ? (
          <button
            type="button"
            className={styles.playToggle}
            aria-label="Play clip"
            onClick={() => setIsPausedByViewer(false)}
          >
            <PlayIcon size={34} />
          </button>
        ) : null}
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
        <div className={styles.overlay}>
          <div className={styles.authorRow}>
            <Link href={`/user/${clip.author.id}`} className={styles.clipAuthor}>
              <Avatar name={clip.author.name} src={clip.author.avatarUrl} size="sm" />
              <span className={styles.authorNames}>
                <span className={styles.authorName}>{clip.author.name}</span>
                <span className={styles.authorHandle}>@{clip.author.username}</span>
              </span>
            </Link>
            <button
              type="button"
              className={[styles.followPill, engagement.isFollowing ? styles.followPillActive : ""].join(" ")}
              aria-pressed={engagement.isFollowing}
              onClick={onToggleFollow}
            >
              {engagement.isFollowing ? "Following" : "Follow"}
            </button>
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
        <span className={styles.actionItem} aria-label={`Views, ${clip.views}`}>
          <span className={styles.actionCircleStatic}>
            <EyeIcon size={24} />
          </span>
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
          />
        </span>
      </div>
    </article>
  );
}
