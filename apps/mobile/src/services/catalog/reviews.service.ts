import type { ProductRatingSummary, ProductReview, ProductReviewPage, SubmitReviewInput } from "@/types/commerce.type";

import { api } from "../core/apiClient.service";

export const reviewsService = {
  fetchProductReviews: async (productId: string, cursor: string | null = null, limit = 20): Promise<ProductReviewPage> => {
    const page = await api.get<Partial<ProductReviewPage>>(`/api/v1/products/${productId}/reviews`, { cursor: cursor ?? undefined, limit });
    return { average: page.average ?? 0, count: page.count ?? 0, reviews: page.reviews ?? [], nextCursor: page.nextCursor ?? null };
  },
  fetchRatingSummary: (productId: string) => api.get<ProductRatingSummary>(`/api/v1/products/${productId}/rating-summary`),
  submitProductReview: (productId: string, input: SubmitReviewInput, idempotencyKey: string) =>
    api.post<ProductReview>(`/api/v1/products/${productId}/reviews`, input, { idempotencyKey }),
  deleteOwnReview: (reviewId: string) => api.delete<void>(`/api/v1/reviews/${reviewId}`),
};
