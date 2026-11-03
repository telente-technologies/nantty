import type { Media } from "@/types";

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
