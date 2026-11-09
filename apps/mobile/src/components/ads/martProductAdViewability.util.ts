export interface MartProductAdBounds {
  readonly contentTop: number;
  readonly cardTop: number;
  readonly cardHeight: number;
  readonly scrollOffset: number;
  readonly viewportHeight: number;
}

/** Returns the fraction of the product-ad card intersecting the Mart viewport. */
export function martProductAdVisibleFraction(bounds: MartProductAdBounds): number {
  const { contentTop, cardTop, cardHeight, scrollOffset, viewportHeight } = bounds;
  if (![contentTop, cardTop, cardHeight, scrollOffset, viewportHeight].every(Number.isFinite) || cardHeight <= 0 || viewportHeight <= 0) return 0;
  const top = contentTop + cardTop - scrollOffset;
  const bottom = top + cardHeight;
  const visible = Math.max(0, Math.min(bottom, viewportHeight) - Math.max(top, 0));
  return visible / cardHeight;
}

export const MART_PRODUCT_AD_MINIMUM_VISIBLE_FRACTION = 0.5;
export const MART_PRODUCT_AD_MINIMUM_VISIBLE_MILLIS = 1_000;
