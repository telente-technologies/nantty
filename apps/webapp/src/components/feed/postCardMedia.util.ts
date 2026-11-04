import type { Media } from "@/types";

export const POST_IMAGE_ZOOM_SCALE = 2.5;

export function isHlsUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /\.m3u8(?:[?#]|$)/i.test(url);
}

export function selectPostVideoSource(media: Media, supportsNativeHls: boolean): string | null {
  if (media.type !== "video") return null;

  if (supportsNativeHls && media.hlsUrl) return media.hlsUrl;
  if (media.url && !isHlsUrl(media.url)) return media.url;
  if (supportsNativeHls && isHlsUrl(media.url)) return media.url;

  return null;
}

export function canPlayInline(media: Media): boolean {
  return media.type === "video" && Boolean(media.url || media.hlsUrl);
}

export function getAdjacentPostImageIndex(index: number, imageCount: number, direction: -1 | 1): number {
  if (imageCount <= 0) return 0;
  return (Math.trunc(index) + direction + imageCount) % imageCount;
}

export function describeCarouselPosition(index: number, itemCount: number): string {
  const safeCount = Math.max(0, Math.trunc(itemCount));
  if (safeCount === 0) return "";
  const safeIndex = Math.min(Math.max(0, Math.trunc(index)), safeCount - 1);
  return `Item ${safeIndex + 1} of ${safeCount}`;
}

export function describePostImagePreview(index: number, imageCount: number): { readonly buttonLabel: string; readonly imageAlt: string; readonly positionLabel: string } {
  const safeCount = Math.max(0, Math.trunc(imageCount));
  const safeIndex = safeCount === 0 ? 0 : Math.min(Math.max(0, Math.trunc(index)), safeCount - 1);
  const position = safeCount === 0 ? "" : ` ${safeIndex + 1} of ${safeCount}`;
  return {
    buttonLabel: `Open post image${position}`,
    imageAlt: `Post image${position}`,
    positionLabel: safeCount === 0 ? "" : `Image ${safeIndex + 1} of ${safeCount}`,
  };
}

export function describePostImageZoom(isZoomed: boolean): { readonly label: string; readonly pressed: boolean } {
  return isZoomed
    ? { label: "Fit image to screen", pressed: true }
    : { label: "Zoom image", pressed: false };
}

export function clampPostImagePan(
  pan: { readonly x: number; readonly y: number },
  stage: { readonly width: number; readonly height: number },
  image: { readonly width?: number; readonly height?: number },
  zoom = POST_IMAGE_ZOOM_SCALE,
): { readonly x: number; readonly y: number } {
  const stageWidth = Math.max(0, stage.width);
  const stageHeight = Math.max(0, stage.height);
  const imageWidth = image.width ?? stageWidth;
  const imageHeight = image.height ?? stageHeight;
  if (stageWidth === 0 || stageHeight === 0 || imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0 };

  const scale = Math.max(1, zoom);
  const fit = Math.min(stageWidth / imageWidth, stageHeight / imageHeight);
  const maxX = Math.max(0, (imageWidth * fit * scale - stageWidth) / 2);
  const maxY = Math.max(0, (imageHeight * fit * scale - stageHeight) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
}
