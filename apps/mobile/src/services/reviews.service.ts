import type { ProductReviewSummary } from "@/types/commerce.type";

import { api } from "./apiClient.service";

export const reviewsService = {
  fetchProductReviews: (productId: string) => api.get<ProductReviewSummary>(`/api/v1/products/${productId}/reviews`),
  submitProductReview: (productId: string, rating: number, text: string) =>
    api.post<void>(`/api/v1/products/${productId}/reviews`, { rating, text }),
};
