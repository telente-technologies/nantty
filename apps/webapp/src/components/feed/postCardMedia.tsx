"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { ArrowLeftIcon, ArrowRightIcon, PlayIcon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { MediaImage } from "@/components/ui/media";
import { InlineVideoPlayer } from "@/components/video/inlineVideoPlayer";
import type { Media, Post } from "@/types";
import { canPlayInline, describeCarouselPosition, describePostImagePreview, describePostImageZoom, getAdjacentPostImageIndex, isHlsUrl, selectPostVideoSource } from "./postCardMedia.util";

import styles from "./postCardMedia.module.css";

export function PostMedia({ media, priority, watchHref }: { readonly media: readonly Media[]; readonly priority: boolean; readonly watchHref: string | null }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isPreviewZoomed, setIsPreviewZoomed] = useState(false);
  const visible = media.filter((entry) => entry.type === "image" || entry.posterUrl || entry.url || entry.hlsUrl);
  if (visible.length === 0) return null;
  const active = visible[Math.min(imageIndex, visible.length - 1)];
  const images = visible.filter((entry): entry is Media & { readonly type: "image"; readonly url: string } => entry.type === "image" && Boolean(entry.url));

  if (visible.length > 1) {
    return (
      <div className={styles.mediaFrame}>
        <div
          className={styles.mediaScroller}
          data-swipe-ignore
          role="region"
          aria-label="Post media carousel"
          tabIndex={0}
          onScroll={(event) => setImageIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
        >
          {visible.map((entry, index) => (
            <div className={styles.mediaSlide} key={`${entry.id ?? index}`}>
              {index === Math.min(imageIndex, visible.length - 1) && canPlayInline(entry) ? (
                <PostCardVideo media={entry} priority={priority && index === 0} />
              ) : entry.type === "image" && entry.url ? (
                <button type="button" className={styles.imageTrigger} aria-label={describePostImagePreview(images.findIndex((image) => image === entry), images.length).buttonLabel} onClick={() => setPreviewIndex(images.findIndex((image) => image === entry))}>
                  <MediaImage src={entry.url} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority && index === 0} />
                </button>
              ) : (
                <MediaImage src={entry.type === "image" ? entry.url : (entry.posterUrl ?? entry.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority && index === 0} />
              )}
            </div>
          ))}
        </div>
        <span className="visuallyHidden" aria-live="polite" aria-atomic="true">
          {describeCarouselPosition(Math.min(imageIndex, visible.length - 1), visible.length)}
        </span>
        <PostImagePreviewDialog images={images} index={previewIndex} isZoomed={isPreviewZoomed} onZoomChange={setIsPreviewZoomed} onClose={() => { setPreviewIndex(null); setIsPreviewZoomed(false); }} onIndexChange={(nextIndex) => { setPreviewIndex(nextIndex); setIsPreviewZoomed(false); }} />
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
      {active?.type === "video" && canPlayInline(active) ? (
        <PostCardVideo media={active} priority={priority} />
      ) : active?.type === "image" && active.url ? (
        <>
          <button type="button" className={styles.imageTrigger} aria-label={describePostImagePreview(0, 1).buttonLabel} onClick={() => setPreviewIndex(0)}>
            <MediaImage src={active.url} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />
          </button>
          <PostImagePreviewDialog images={images} index={previewIndex} isZoomed={isPreviewZoomed} onZoomChange={setIsPreviewZoomed} onClose={() => { setPreviewIndex(null); setIsPreviewZoomed(false); }} onIndexChange={(nextIndex) => { setPreviewIndex(nextIndex); setIsPreviewZoomed(false); }} />
        </>
      ) : (
        <MediaImage src={active?.type === "image" ? active.url : (active?.posterUrl ?? active?.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />
      )}
    </div>
  );
}

function PostImagePreviewDialog({ images, index, isZoomed, onZoomChange, onClose, onIndexChange }: { readonly images: readonly Media[]; readonly index: number | null; readonly isZoomed: boolean; readonly onZoomChange: (isZoomed: boolean) => void; readonly onClose: () => void; readonly onIndexChange: (index: number) => void }) {
  const isOpen = index !== null && images.length > 0;
  const currentIndex = isOpen ? Math.min(index, images.length - 1) : 0;
  const current = images[currentIndex];
  const hasImage = Boolean(current?.url);
  const description = describePostImagePreview(currentIndex, images.length);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Post image preview" layout="centered" size="large" closeLabel="Close image preview">
      {hasImage ? (
        <div className={styles.previewStage}>
          <MediaImage src={current?.url} alt={description.imageAlt} sizes="(max-width: 768px) 100vw, 960px" className={[styles.previewImage, isZoomed ? styles.previewImageZoomed : ""].join(" ")} />
          {images.length > 1 ? (
            <button type="button" className={styles.previewPrevious} aria-label="Previous image" onClick={() => onIndexChange(getAdjacentPostImageIndex(currentIndex, images.length, -1))}>
              <ArrowLeftIcon size={22} />
            </button>
          ) : null}
          {images.length > 1 ? (
            <button type="button" className={styles.previewNext} aria-label="Next image" onClick={() => onIndexChange(getAdjacentPostImageIndex(currentIndex, images.length, 1))}>
              <ArrowRightIcon size={22} />
            </button>
          ) : null}
          <button type="button" className={styles.previewZoom} aria-label={describePostImageZoom(isZoomed).label} aria-pressed={describePostImageZoom(isZoomed).pressed} onClick={() => onZoomChange(!isZoomed)}>
            {isZoomed ? "Fit" : "Zoom"}
          </button>
          {images.length > 1 ? <p className={styles.previewPosition} aria-live="polite">{description.positionLabel}</p> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

function PostCardVideo({ media, priority }: { readonly media: Media; readonly priority: boolean }) {
  const supportsNativeHls = useSyncExternalStore(subscribeToHlsSupport, getNativeHlsSupport, () => false);
  const [hasHlsFailed, setHasHlsFailed] = useState(false);

  const src = selectPostVideoSource(media, supportsNativeHls && !hasHlsFailed);
  if (!src) {
    return <MediaImage src={media.posterUrl ?? media.url} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />;
  }

  return (
    <InlineVideoPlayer
      key={src}
      className={styles.video}
      src={src}
      poster={media.posterUrl}
      durationSeconds={media.durationSeconds}
      onError={isHlsUrl(src) ? () => setHasHlsFailed(true) : undefined}
    />
  );
}

function getNativeHlsSupport(): boolean {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return Boolean(video.canPlayType("application/vnd.apple.mpegurl") || video.canPlayType("application/x-mpegURL"));
}

function subscribeToHlsSupport(): () => void {
  return () => undefined;
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
