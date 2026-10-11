"use client";

import Link from "next/link";
import { useState } from "react";

import { PlayIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import { InlineVideoPlayer } from "@/components/video/inlineVideoPlayer";
import type { Media, Post } from "@/types";

import styles from "./postCardMedia.module.css";

export function PostMedia({ media, priority, watchHref }: { readonly media: readonly Media[]; readonly priority: boolean; readonly watchHref: string | null }) {
  const [imageIndex, setImageIndex] = useState(0);
  const visible = media.filter((entry) => entry.type === "image" || entry.posterUrl || entry.url);
  if (visible.length === 0) return null;
  const active = visible[Math.min(imageIndex, visible.length - 1)];

  if (visible.length > 1) {
    return (
      <div className={styles.mediaFrame}>
        <div className={styles.mediaScroller} data-swipe-ignore onScroll={(event) => setImageIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
          {visible.map((entry, index) => (
            <div className={styles.mediaSlide} key={`${entry.id ?? index}`}>
              <MediaImage src={entry.type === "image" ? entry.url : (entry.posterUrl ?? entry.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority && index === 0} />
            </div>
          ))}
        </div>
        <div className={styles.mediaDots} aria-hidden="true">
          {visible.map((entry, index) => (
            <span key={entry.id ?? index} className={index === Math.min(imageIndex, visible.length - 1) ? styles.mediaDotActive : styles.mediaDot} />
          ))}
        </div>
      </div>
    );
  }

  if (active?.type === "video" && watchHref) {
    return (
      <Link href={watchHref} className={[styles.mediaFrame, styles.videoFrame].join(" ")} aria-label="Watch video">
        <MediaImage src={active.posterUrl ?? null} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />
        <span className={styles.playBadge} aria-hidden="true">
          <PlayIcon size={22} />
        </span>
        {active.durationSeconds ? <span className={styles.durationBadge}>{formatVideoDuration(active.durationSeconds)}</span> : null}
      </Link>
    );
  }

  return (
    <div className={styles.mediaFrame}>
      {active?.type === "video" && active.url && !active.url.endsWith(".m3u8") ? (
        <InlineVideoPlayer className={styles.video} src={active.url} poster={active.posterUrl} durationSeconds={active.durationSeconds} />
      ) : (
        <MediaImage src={active?.type === "image" ? active.url : (active?.posterUrl ?? active?.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />
      )}
    </div>
  );
}

export function formatVideoDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isLandscapeVideoPost(post: Post): boolean {
  const first = post.media[0];
  return post.media.length === 1 && first?.type === "video" && (first.width ?? 0) > (first.height ?? 0);
}

export function hasVideoMedia(post: Post): boolean {
  return post.media.some((entry) => entry.type === "video");
}
