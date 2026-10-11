import { VIDEO_SEEK_BAR_TOUCH_HEIGHT } from "@/utils/videoSeek.util";

export const CLIP_OVERLAY_GAP_ABOVE_BOTTOM_EDGE = 12;
export const CLIP_OVERLAY_GAP_ABOVE_SEEK_BAR = 4;
export const CLIPS_HEADER_HEIGHT = 64;
const MIN_CAPTION_HEIGHT = 120;
const OVERLAY_ROWS_OUTSIDE_CAPTION = 150;

export function bottomSafeAreaNotCoveredByTabBar(safeAreaBottom: number, frameHeight: number, pageHeight: number): number {
  const heightCoveredBelowPage = Math.max(frameHeight - pageHeight, 0);
  return Math.max(safeAreaBottom - heightCoveredBelowPage, 0);
}

export function clipOverlayBottomOffset(uncoveredBottomInset: number, hasSeekBar = false): number {
  return uncoveredBottomInset + (hasSeekBar ? VIDEO_SEEK_BAR_TOUCH_HEIGHT + CLIP_OVERLAY_GAP_ABOVE_SEEK_BAR : CLIP_OVERLAY_GAP_ABOVE_BOTTOM_EDGE);
}

export function clipCaptionMaxHeight(pageHeight: number, topInset: number, overlayBottomOffset: number): number {
  const spaceBelowHeader = pageHeight - topInset - CLIPS_HEADER_HEIGHT - overlayBottomOffset - OVERLAY_ROWS_OUTSIDE_CAPTION;
  return Math.max(spaceBelowHeader, MIN_CAPTION_HEIGHT);
}
