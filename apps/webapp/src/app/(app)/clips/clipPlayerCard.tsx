"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { LikeActionIcon, LikeFilledActionIcon, PlayIcon, ReplyActionIcon, SendActionIcon } from "@/components/ui/icons";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { postsService } from "@/services/posts.service";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { Avatar, MediaImage } from "@/components/ui/media";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import type { Clip } from "@/types";

import styles from "./page.module.css";
import { IconLabel } from "@/components/ui/appIcon";

function canPlayInBrowser(url: string | null): url is string {
  return !!url && !url.endsWith(".m3u8");
}

export function ClipPlayerCard({ clip, isActive }: { readonly clip: Clip; readonly isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPausedByViewer, setIsPausedByViewer] = useState(false);
  const [isLiked, setIsLiked] = useState(clip.liked);
  const [likeCount, setLikeCount] = useState(clip.likes);
  const toggleLike = () =>
    requireAuthThen(() => {
      const likeNow = !isLiked;
      setIsLiked(likeNow);
      setLikeCount((count) => Math.max(0, count + (likeNow ? 1 : -1)));
      void (likeNow ? postsService.likePost(clip.id) : postsService.unlikePost(clip.id)).catch(() => {
        setIsLiked(!likeNow);
        setLikeCount((count) => Math.max(0, count + (likeNow ? -1 : 1)));
      });
    }, "Sign in to like clips.");
  const media = clip.media[0];
  const playableUrl = canPlayInBrowser(media?.url ?? null) ? media!.url! : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !isPausedByViewer) void video.play().catch(() => setIsPausedByViewer(true));
    else video.pause();
  }, [isActive, isPausedByViewer]);

  useEffect(() => {
    if (!isActive) setIsPausedByViewer(false);
  }, [isActive]);

  return (
    <article className={styles.clip} data-clip-id={clip.id} aria-label={`Clip by ${clip.author.name}`}>
      <div className={styles.stage}>
        {playableUrl ? (
          <video
            ref={videoRef}
            className={styles.video}
            src={playableUrl}
            poster={media?.posterUrl ?? undefined}
            loop
            muted
            playsInline
            preload={isActive ? "auto" : "metadata"}
            onClick={() => setIsPausedByViewer((paused) => !paused)}
          />
        ) : (
          <MediaImage src={media?.posterUrl ?? null} alt="" sizes="420px" />
        )}
        {playableUrl ? (
          <button type="button" className={styles.playToggle} aria-label={isPausedByViewer ? "Play clip" : "Pause clip"} onClick={() => setIsPausedByViewer((paused) => !paused)}>
            {isPausedByViewer ? <PlayIcon size={34} /> : null}
          </button>
        ) : null}
        <div className={styles.overlay}>
          <Link href={`/user/${clip.author.id}`} className={styles.clipAuthor}>
            <Avatar name={clip.author.name} src={clip.author.avatarUrl} size="sm" />
            <span>{clip.author.name}</span>
          </Link>
          <p className={styles.clipCaption}>{clip.text}</p>
          <p className={styles.clipSound}><IconLabel name="musicNotes24" size={14}>{clip.sound.title}</IconLabel></p>
          {clip.products[0] ? (
            <Link href={`/product/${clip.products[0].id}`} className={styles.productChip}>
              Shop: {clip.products[0].name}
            </Link>
          ) : null}
        </div>
      </div>
      <div className={styles.actionColumn}>
        <span className={styles.actionItem}>
          <button type="button" className={styles.actionCircle} aria-pressed={isLiked} aria-label={`Like, ${likeCount} likes`} onClick={toggleLike}>
            {isLiked ? <LikeFilledActionIcon size={24} /> : <LikeActionIcon size={24} />}
          </button>
          {formatCountWithThousandsSuffix(likeCount)}
        </span>
        <span className={styles.actionItem}>
          <Link href={`/post/${clip.id}#comments`} className={styles.actionCircle} aria-label={`Comments, ${clip.comments}`}>
            <ReplyActionIcon size={24} />
          </Link>
          {formatCountWithThousandsSuffix(clip.comments)}
        </span>
        <span className={styles.actionItem}>
          <SaveToggleButton targetType="clip" targetId={clip.id} initiallySaved={clip.bookmarked} appearance="overlay" iconSize={24} />
          {formatCountWithThousandsSuffix(clip.saveCount ?? 0)}
        </span>
        <span className={styles.actionItem}>
          <ShareToChatButton kind="clip" referenceId={clip.id} className={styles.actionCircle} icon={<SendActionIcon size={24} />} iconOnly />
          {formatCountWithThousandsSuffix(clip.reposts)}
        </span>
        <span className={styles.actionItem}>
          <ContentActionsMenu shareKind={null} reportTargetType="clip" targetId={clip.id} canonicalPath={`/clips?start=${clip.id}`} triggerClassName={styles.actionCircle} />
        </span>
      </div>
    </article>
  );
}
