import {
  bottomSafeAreaNotCoveredByTabBar,
  clipCaptionMaxHeight,
  clipOverlayBottomOffset,
} from "../clipPageLayout.util";

const TAB_BAR_CONTENT_HEIGHT = 1 + 12 + 44;
const tabBarHeight = (safeAreaBottom: number) => TAB_BAR_CONTENT_HEIGHT + Math.max(safeAreaBottom, 12);

const devices = [
  { name: "iPhone SE", height: 667, top: 20, bottom: 0 },
  { name: "iPhone Pro Max", height: 932, top: 59, bottom: 34 },
  { name: "Android gesture nav", height: 915, top: 24, bottom: 16 },
];

describe("clip page layout", () => {
  it.each(devices)("keeps the overlay 12px above the tab bar on $name", ({ height, top, bottom }) => {
    const pageHeight = height - tabBarHeight(bottom);
    const uncovered = bottomSafeAreaNotCoveredByTabBar(bottom, height, pageHeight);
    expect(uncovered).toBe(0);
    expect(clipOverlayBottomOffset(uncovered)).toBe(12);
    expect(clipCaptionMaxHeight(pageHeight, top, 12)).toBeGreaterThanOrEqual(120);
  });

  it("clears the home indicator when the page runs to the bottom edge", () => {
    const uncovered = bottomSafeAreaNotCoveredByTabBar(34, 932, 932);
    expect(uncovered).toBe(34);
    expect(clipOverlayBottomOffset(uncovered)).toBe(46);
  });

  it("caps an expanded caption below the header on a small screen", () => {
    const pageHeight = 667 - tabBarHeight(0);
    const captionMax = clipCaptionMaxHeight(pageHeight, 20, 12);
    expect(20 + 64 + captionMax + 150 + 12).toBeLessThanOrEqual(pageHeight);
  });

  it("never returns a negative inset", () => {
    expect(bottomSafeAreaNotCoveredByTabBar(0, 600, 700)).toBe(0);
  });
});
