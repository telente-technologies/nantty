import { ApiError } from "@/errors/api.error";
import type { ProductRatingSummary, ProductReview, RatingStar, SubmitReviewInput } from "@/types/commerce.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { mockOrderRecords, SIGNED_IN_BUYER } from "./orderFixtures.mock";
import { productIdForKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildReviewSummaryForProduct } from "./reviewFixtures.mock";

const PAGE_SIZE = 20;
const submittedReviewsByProductId = new Map<string, ProductReview[]>();
const reviewedProductKeys = new Set<string>();

const allReviewsFor = (productId: string): ProductReview[] => [...(submittedReviewsByProductId.get(productId) ?? []), ...buildReviewSummaryForProduct(productId).reviews];

const buyerReceivedProduct = (productId: string) =>
  mockOrderRecords.some((record) => record.buyerUserId === SIGNED_IN_BUYER && (record.status === "delivered" || record.status === "completed") && record.lines.some((line) => productIdForKey(line.productKey) === productId));

const summarise = (reviews: readonly ProductReview[]): ProductRatingSummary => {
  const distribution: Record<RatingStar, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const review of reviews) distribution[String(review.rating) as RatingStar] += 1;
  const average = reviews.length === 0 ? 0 : Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10;
  return { average, count: reviews.length, distribution };
};

export const productReviewsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/products/:productId/reviews", ({ params, query }) => {
    const reviews = allReviewsFor(params.productId!);
    const start = Number(query.get("cursor") ?? 0) || 0;
    const limit = Math.min(Number(query.get("limit") ?? PAGE_SIZE) || PAGE_SIZE, 50);
    const end = start + limit;
    return { ...summarise(reviews), reviews: reviews.slice(start, end), nextCursor: end < reviews.length ? String(end) : null };
  }),
  createMockRoute("GET", "/api/v1/products/:productId/rating-summary", ({ params }) => summarise(allReviewsFor(params.productId!))),
  createMockRoute("POST", "/api/v1/products/:productId/reviews", ({ params, body }) => {
    const productId = params.productId!;
    const input = (body ?? {}) as Partial<SubmitReviewInput>;
    if (!Number.isInteger(input.rating) || input.rating! < 1 || input.rating! > 5 || typeof input.text !== "string") throw new ApiError(400, "Validation failed", "VALIDATION_FAILED");
    if (!buyerReceivedProduct(productId)) throw new ApiError(403, "Only buyers who received this product can review it.", "REVIEW_REQUIRES_PURCHASE");
    if (reviewedProductKeys.has(productId)) throw new ApiError(409, "You already reviewed this.", "ALREADY_REVIEWED");
    reviewedProductKeys.add(productId);
    const author = getSignedInMockUser();
    const review: ProductReview = {
      id: `rv_new_${Date.now().toString(36)}`,
      author: { id: author.id, name: author.name, username: author.username, avatarUrl: author.avatarUrl },
      rating: input.rating!,
      text: input.text.trim(),
      title: input.title ?? null,
      isVerifiedPurchase: true,
      reply: null,
      createdAt: new Date().toISOString(),
    };
    submittedReviewsByProductId.set(productId, [review, ...(submittedReviewsByProductId.get(productId) ?? [])]);
    return review;
  }),
];
