import { ApiError } from "@/errors/api.error";
import type { ProductRatingSummary, ProductReview, ProductReviewPage, RatingStar } from "@/types/commerce.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { SIGNED_IN_BUYER, mockOrderRecords } from "./orderFixtures.mock";
import { productIdForKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildSeededReviewsForProduct } from "./reviewFixtures.mock";

const submittedReviewsByProductId = new Map<string, ProductReview[]>();
let nextReviewNumber = 1;

const isReviewable = (status: string) => status === "delivered" || status === "completed";

export const signedInBuyerReceivedProduct = (productId: string) =>
  mockOrderRecords.some(
    (record) => record.buyerUserId === SIGNED_IN_BUYER && isReviewable(record.status) && record.lines.some((line) => productIdForKey(line.productKey) === productId),
  );

export const listMockReviewsForProduct = (productId: string): ProductReview[] =>
  [...(submittedReviewsByProductId.get(productId) ?? []), ...buildSeededReviewsForProduct(productId)];

export function buildMockRatingSummary(productId: string): ProductRatingSummary {
  const reviews = listMockReviewsForProduct(productId);
  const distribution: Record<RatingStar, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const review of reviews) distribution[String(review.rating) as RatingStar] += 1;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: reviews.length > 0 ? total / reviews.length : 0, count: reviews.length, distribution };
}

export function buildMockReviewPage(productId: string, cursor: string | null, limit: number): ProductReviewPage {
  const reviews = listMockReviewsForProduct(productId);
  const start = cursor ? Number(cursor) : 0;
  const end = start + limit;
  const summary = buildMockRatingSummary(productId);
  return { average: summary.average, count: summary.count, reviews: reviews.slice(start, end), nextCursor: end < reviews.length ? String(end) : null };
}

function submitMockReview(productId: string, body: unknown): ProductReview {
  const input = (body ?? {}) as { rating?: number; text?: string; title?: string | null };
  const viewer = getSignedInMockUser();
  if (!signedInBuyerReceivedProduct(productId)) throw new ApiError(403, "Only buyers who received this product can review it.", "REVIEW_REQUIRES_PURCHASE");
  if (listMockReviewsForProduct(productId).some((review) => review.author.id === viewer.id)) throw new ApiError(409, "You already reviewed this.", "ALREADY_REVIEWED");
  const text = (input.text ?? "").trim();
  if (!Number.isInteger(input.rating) || input.rating! < 1 || input.rating! > 5 || text.length < 1 || text.length > 2000) {
    throw new ApiError(422, "Check the highlighted fields", "VALIDATION_FAILED");
  }
  const review: ProductReview = {
    id: `rv_mine_${nextReviewNumber++}`,
    author: { id: viewer.id, name: viewer.name, username: viewer.username, avatarUrl: viewer.avatarUrl },
    rating: input.rating!,
    text,
    title: input.title?.trim() || null,
    isVerifiedPurchase: true,
    reply: null,
    createdAt: new Date().toISOString(),
  };
  submittedReviewsByProductId.set(productId, [review, ...(submittedReviewsByProductId.get(productId) ?? [])]);
  return review;
}

function deleteMockReview(reviewId: string) {
  const viewerId = getSignedInMockUser().id;
  for (const [productId, reviews] of submittedReviewsByProductId) {
    if (reviews.some((review) => review.id === reviewId && review.author.id === viewerId)) {
      submittedReviewsByProductId.set(productId, reviews.filter((review) => review.id !== reviewId));
      return;
    }
  }
  throw new ApiError(404, "Review not found", "REVIEW_NOT_FOUND");
}

export const resetMockReviews = () => submittedReviewsByProductId.clear();

export const reviewsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/products/:productId/reviews", ({ params, query }) =>
    buildMockReviewPage(params.productId!, query.get("cursor"), Math.min(Number(query.get("limit") ?? 20) || 20, 50)),
  ),
  createMockRoute("GET", "/api/v1/products/:productId/rating-summary", ({ params }) => buildMockRatingSummary(params.productId!)),
  createMockRoute("POST", "/api/v1/products/:productId/reviews", ({ params, body }) => submitMockReview(params.productId!, body)),
  createMockRoute("DELETE", "/api/v1/reviews/:reviewId", ({ params }) => deleteMockReview(params.reviewId!)),
];
