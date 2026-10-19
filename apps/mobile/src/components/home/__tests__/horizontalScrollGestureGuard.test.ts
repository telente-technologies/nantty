import { horizontalScrollGestureGuardProps, isTouchInsideHorizontalScroller, resetHorizontalScrollerTouches } from "../horizontalScrollGestureGuard.util";
import { isHorizontalSectionSwipe } from "../homeSectionSwipe.util";

const pagerWouldClaim = (dx: number, dy: number) => !isTouchInsideHorizontalScroller() && isHorizontalSectionSwipe(dx, dy);

describe("Feed/Mart swipe vs sideways scrollers", () => {
  afterEach(resetHorizontalScrollerTouches);

  it("lets the pager take a sideways drag that starts outside any carousel", () => {
    expect(pagerWouldClaim(-40, 2)).toBe(true);
  });

  it("leaves a drag that starts on a photo carousel or rail to that carousel", () => {
    horizontalScrollGestureGuardProps.onTouchStart();
    expect(pagerWouldClaim(-40, 2)).toBe(false);
    horizontalScrollGestureGuardProps.onTouchEnd();
    expect(pagerWouldClaim(-40, 2)).toBe(true);
  });

  it("handles nested carousels and cancelled touches without getting stuck", () => {
    horizontalScrollGestureGuardProps.onTouchStart();
    horizontalScrollGestureGuardProps.onTouchStart();
    horizontalScrollGestureGuardProps.onTouchEnd();
    expect(isTouchInsideHorizontalScroller()).toBe(true);
    horizontalScrollGestureGuardProps.onTouchCancel();
    expect(isTouchInsideHorizontalScroller()).toBe(false);
    horizontalScrollGestureGuardProps.onTouchEnd();
    expect(isTouchInsideHorizontalScroller()).toBe(false);
  });

  it("recovers when a touch end was missed", () => {
    horizontalScrollGestureGuardProps.onTouchStart();
    resetHorizontalScrollerTouches();
    expect(pagerWouldClaim(-40, 2)).toBe(true);
  });
});
