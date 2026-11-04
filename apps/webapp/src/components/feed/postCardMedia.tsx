"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

import { ArrowLeftIcon, ArrowRightIcon, PlayIcon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { MediaImage } from "@/components/ui/media";
import { InlineVideoPlayer } from "@/components/video/inlineVideoPlayer";
import type { Media, Post } from "@/types";
import { canPlayInline, clampPostImagePan, describeCarouselPosition, describePostImagePreview, describePostImageZoom, getAdjacentPostImageIndex, isHlsUrl, POST_IMAGE_ZOOM_SCALE, selectPostVideoSource } from "./postCardMedia.util";

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const pointer = useRef<{ readonly id: number; readonly startX: number; readonly startY: number; readonly originX: number; readonly originY: number } | null>(null);
  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
    pointer.current = null;
  };
  const isOpen = index !== null && images.length > 0;
  const currentIndex = isOpen ? Math.min(index, images.length - 1) : 0;
  const current = images[currentIndex];
  const hasImage = Boolean(current?.url);
  const description = describePostImagePreview(currentIndex, images.length);

  return (
    <Dialog isOpen={isOpen} onClose={() => { resetView(); onClose(); }} title="Post image preview" layout="centered" size="large" closeLabel="Close image preview">
      {hasImage ? (
        <div className={styles.previewStage}>
          <div
            className={[styles.previewPanSurface, isZoomed ? styles.previewPanSurfaceZoomed : "", isPanning ? styles.previewPanSurfacePanning : ""].join(" ")}
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${isZoomed ? POST_IMAGE_ZOOM_SCALE : 1})` }}
            role={isZoomed ? "group" : undefined}
            aria-label={isZoomed ? "Zoomed image. Drag or use arrow keys to pan." : undefined}
            tabIndex={isZoomed ? 0 : -1}
            onPointerDown={(event) => {
              if (!isZoomed || event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsPanning(true);
              pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
            }}
            onPointerMove={(event) => {
              const origin = pointer.current;
              if (!isZoomed || !origin || origin.id !== event.pointerId) return;
              const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!bounds) return;
              const next = clampPostImagePan(
                { x: origin.originX + event.clientX - origin.startX, y: origin.originY + event.clientY - origin.startY },
                { width: bounds.width, height: bounds.height },
                { width: current?.width, height: current?.height },
              );
              setPan(next);
            }}
            onPointerUp={(event) => {
              if (pointer.current?.id !== event.pointerId) return;
              pointer.current = null;
              setIsPanning(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { pointer.current = null; setIsPanning(false); }}
            onKeyDown={(event) => {
              if (!isZoomed || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              const distance = 32;
              const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!bounds) return;
              const delta = {
                x: event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0,
                y: event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0,
              };
              setPan(clampPostImagePan(
                { x: pan.x + delta.x, y: pan.y + delta.y },
                { width: bounds.width, height: bounds.height },
                { width: current?.width, height: current?.height },
              ));
            }}
          >
            <MediaImage src={current?.url} alt={description.imageAlt} sizes="(max-width: 768px) 100vw, 960px" className={styles.previewImage} />
          </div>
          {images.length > 1 ? (
            <button type="button" className={styles.previewPrevious} aria-label="Previous image" onClick={() => { resetView(); onIndexChange(getAdjacentPostImageIndex(currentIndex, images.length, -1)); }}>
              <ArrowLeftIcon size={22} />
            </button>
          ) : null}
          {images.length > 1 ? (
            <button type="button" className={styles.previewNext} aria-label="Next image" onClick={() => { resetView(); onIndexChange(getAdjacentPostImageIndex(currentIndex, images.length, 1)); }}>
              <ArrowRightIcon size={22} />
            </button>
          ) : null}
          <button type="button" className={styles.previewZoom} aria-label={describePostImageZoom(isZoomed).label} aria-pressed={describePostImageZoom(isZoomed).pressed} onClick={() => { resetView(); onZoomChange(!isZoomed); }}>
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
