export type HomeSection = "feed" | "mart";

export const homeSections: readonly HomeSection[] = ["feed", "mart"];

const COMMIT_DISTANCE_FRACTION = 0.35;
const COMMIT_VELOCITY_PIXELS_PER_MILLISECOND = 0.5;
const EDGE_RESISTANCE = 0.3;

export function sectionIndexOf(section: HomeSection): number {
  return Math.max(0, homeSections.indexOf(section));
}

export function isHorizontalSectionSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function dragOffsetWithEdgeResistance(currentIndex: number, dx: number, pageWidth: number): number {
  const restingOffset = -currentIndex * pageWidth;
  const rawOffset = restingOffset + dx;
  const firstPageOffset = 0;
  const lastPageOffset = -(homeSections.length - 1) * pageWidth;
  if (rawOffset > firstPageOffset) return firstPageOffset + (rawOffset - firstPageOffset) * EDGE_RESISTANCE;
  if (rawOffset < lastPageOffset) return lastPageOffset + (rawOffset - lastPageOffset) * EDGE_RESISTANCE;
  return rawOffset;
}

export function resolveSectionIndexAfterRelease(currentIndex: number, dx: number, vx: number, pageWidth: number): number {
  const lastIndex = homeSections.length - 1;
  const flickedTowardNext = vx < -COMMIT_VELOCITY_PIXELS_PER_MILLISECOND && dx < 0;
  const flickedTowardPrevious = vx > COMMIT_VELOCITY_PIXELS_PER_MILLISECOND && dx > 0;
  const draggedPastNext = dx < -pageWidth * COMMIT_DISTANCE_FRACTION;
  const draggedPastPrevious = dx > pageWidth * COMMIT_DISTANCE_FRACTION;
  if ((flickedTowardNext || draggedPastNext) && currentIndex < lastIndex) return currentIndex + 1;
  if ((flickedTowardPrevious || draggedPastPrevious) && currentIndex > 0) return currentIndex - 1;
  return currentIndex;
}
