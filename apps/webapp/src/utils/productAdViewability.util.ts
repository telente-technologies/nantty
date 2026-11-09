export const PRODUCT_AD_VIEWABILITY_THRESHOLD = 0.5;
export const PRODUCT_AD_MINIMUM_VIEW_MS = 1_000;

export function qualifiesAsProductAdImpression(input: {
  readonly productReady: boolean;
  readonly pageVisible: boolean;
  readonly intersectionRatio: number;
  readonly visibleForMs: number;
}): boolean {
  return input.productReady
    && input.pageVisible
    && input.intersectionRatio >= PRODUCT_AD_VIEWABILITY_THRESHOLD
    && input.visibleForMs >= PRODUCT_AD_MINIMUM_VIEW_MS;
}
