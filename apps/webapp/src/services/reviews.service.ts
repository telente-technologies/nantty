import type { ProductRatingSummary, ProductReview, ProductReviewSummary, SubmitReviewInput } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const reviewsService = {
  fetchProductReviews: async (productId: string, cursor: string | null = null, limit = 20): Promise<Required<ProductReviewSummary>> => {
    const page = await sendRequestToWebappServer<Partial<ProductReviewSummary>>(`/api/v1/products/${encodeURIComponent(productId)}/reviews`, { query: { cursor: cursor ?? undefined, limit } });
    return { average: page.average ?? 0, count: page.count ?? 0, reviews: page.reviews ?? [], nextCursor: page.nextCursor ?? null };
  },
  fetchRatingSummary: (productId: string) => sendRequestToWebappServer<ProductRatingSummary>(`/api/v1/products/${encodeURIComponent(productId)}/rating-summary`),
  submitProductReview: (productId: string, input: SubmitReviewInput, idempotencyKey: string) =>
    sendRequestToWebappServer<ProductReview>(`/api/v1/products/${encodeURIComponent(productId)}/reviews`, { method: "POST", body: input, idempotencyKey }),
};
