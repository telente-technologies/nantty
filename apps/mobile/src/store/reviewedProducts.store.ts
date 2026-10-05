import { create } from "zustand";

interface ReviewedProductsState {
  readonly reviewedProductIds: ReadonlySet<string>;
  readonly markReviewed: (productId: string) => void;
  readonly unmarkReviewed: (productId: string) => void;
}

export const useReviewedProductsStore = create<ReviewedProductsState>()((set) => ({
  reviewedProductIds: new Set<string>(),
  markReviewed: (productId) => set((state) => ({ reviewedProductIds: new Set(state.reviewedProductIds).add(productId) })),
  unmarkReviewed: (productId) =>
    set((state) => {
      const next = new Set(state.reviewedProductIds);
      next.delete(productId);
      return { reviewedProductIds: next };
    }),
}));
