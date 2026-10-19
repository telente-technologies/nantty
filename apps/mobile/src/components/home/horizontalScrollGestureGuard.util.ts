let touchesStartedInsideHorizontalScrollers = 0;

function releaseHorizontalScrollerTouch() {
  touchesStartedInsideHorizontalScrollers = Math.max(0, touchesStartedInsideHorizontalScrollers - 1);
}

export const horizontalScrollGestureGuardProps = {
  onTouchStart: () => {
    touchesStartedInsideHorizontalScrollers += 1;
  },
  onTouchEnd: releaseHorizontalScrollerTouch,
  onTouchCancel: releaseHorizontalScrollerTouch,
} as const;

export function isTouchInsideHorizontalScroller(): boolean {
  return touchesStartedInsideHorizontalScrollers > 0;
}

export function resetHorizontalScrollerTouches() {
  touchesStartedInsideHorizontalScrollers = 0;
}
