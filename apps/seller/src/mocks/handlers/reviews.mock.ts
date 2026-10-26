import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildDemoReviews } from "@/mocks/seed/demoReviews.mock";
import type { Review, ReviewReportReason, ReviewsSummary } from "@/types/review.type";

const reportReasons: ReviewReportReason[] = ["spam", "offensive", "fake", "not_about_purchase", "personal_information", "other"];

function readStoreReviews(): Review[] {
  return readStoreScopedMockSlice("reviews", (storeId) => {
    const database = readMockDatabase();
    const seed = [...storeId].reduce((hash, character) => (hash * 33 + character.charCodeAt(0)) >>> 0, 11);
    return { reviews: buildDemoReviews(database.products, database.onlineOrders, seed, database.settings.name) };
  }).reviews;
}

function findReviewIndexOrThrow(reviewId: string): number {
  const index = readStoreReviews().findIndex((review) => review.id === reviewId);
  if (index < 0) throw new MockHttpError(404, "REVIEW_NOT_FOUND", "That review no longer exists.");
  return index;
}

const reviewSorters: Record<string, (first: Review, second: Review) => number> = {
  newest: (first, second) => second.createdAt.localeCompare(first.createdAt),
  oldest: (first, second) => first.createdAt.localeCompare(second.createdAt),
  lowest: (first, second) => first.rating - second.rating || second.createdAt.localeCompare(first.createdAt),
  highest: (first, second) => second.rating - first.rating || second.createdAt.localeCompare(first.createdAt),
  helpful: (first, second) => second.helpfulCount - first.helpfulCount,
};

function buildReviewsSummary(reviews: readonly Review[]): ReviewsSummary {
  const visible = reviews.filter((review) => review.status !== "hidden");
  const totalRating = visible.reduce((sum, review) => sum + review.rating, 0);
  const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const review of visible) distribution[String(review.rating) as keyof typeof distribution] += 1;
  const now = new Date();
  const trend = Array.from({ length: 6 }, (_, offset) => {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - offset), 1));
    const monthKey = monthDate.toISOString().slice(0, 7);
    const monthReviews = visible.filter((review) => review.createdAt.startsWith(monthKey));
    return { month: monthKey, reviewCount: monthReviews.length, averageRatingHundredths: monthReviews.length > 0 ? Math.round((monthReviews.reduce((sum, review) => sum + review.rating, 0) * 100) / monthReviews.length) : 0 };
  });
  const replied = visible.filter((review) => review.reply).length;
  return {
    averageRatingHundredths: visible.length > 0 ? Math.round((totalRating * 100) / visible.length) : 0,
    totalReviews: visible.length,
    productReviews: visible.filter((review) => review.kind === "product").length,
    storeReviews: visible.filter((review) => review.kind === "store").length,
    distribution,
    responseRateBasisPoints: visible.length > 0 ? Math.round((replied * 10_000) / visible.length) : 0,
    unansweredCount: visible.length - replied,
    trend,
  };
}

export function registerReviewMockRoutes(): void {
  registerMockRoute("GET", "/seller/reviews/summary", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, buildReviewsSummary(readStoreReviews()));
  });

  registerMockRoute("GET", "/seller/reviews", (request) => {
    requireMockStorePrincipal(request);
    const kind = request.query.get("kind");
    const rating = Number(request.query.get("rating") ?? 0);
    const replied = request.query.get("replied");
    const sorter = reviewSorters[request.query.get("sort") ?? "newest"] ?? reviewSorters.newest;
    const reviews = readStoreReviews().filter(
      (review) =>
        (!kind || kind === "all" || review.kind === kind) &&
        (!rating || review.rating === rating) &&
        (replied !== "yes" || review.reply !== null) &&
        (replied !== "no" || review.reply === null) &&
        matchesSearchText(request.query.get("q"), review.body, review.title, review.author.name, review.author.username, review.product?.name, review.orderNumber),
    );
    return respondWithJson(200, paginateMockList([...reviews].sort(sorter), request.query, 10));
  });

  registerMockRoute("PUT", "/seller/reviews/:reviewId/reply", (request) => {
    requireMockStorePrincipal(request);
    const reviews = readStoreReviews();
    const index = findReviewIndexOrThrow(request.params.reviewId ?? "");
    const review = reviews[index] as Review;
    const body = String(readJsonObjectBody(request).body ?? "").trim();
    if (body.length < 2 || body.length > 1000) return respondWithValidationFailure([{ path: "body", message: "Write a reply of 2–1,000 characters." }]);
    const now = new Date().toISOString();
    const updated: Review = { ...review, reply: { body, authorName: readMockDatabase().settings.name, createdAt: review.reply?.createdAt ?? now, updatedAt: review.reply ? now : null } };
    reviews[index] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/reviews/:reviewId/reply", (request) => {
    requireMockStorePrincipal(request);
    const reviews = readStoreReviews();
    const index = findReviewIndexOrThrow(request.params.reviewId ?? "");
    const updated: Review = { ...(reviews[index] as Review), reply: null };
    reviews[index] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("POST", "/seller/reviews/:reviewId/report", (request) => {
    requireMockStorePrincipal(request);
    const reviews = readStoreReviews();
    const index = findReviewIndexOrThrow(request.params.reviewId ?? "");
    const body = readJsonObjectBody(request);
    const reason = body.reason as ReviewReportReason;
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const issues: { path: string; message: string }[] = [];
    if (!reportReasons.includes(reason)) issues.push({ path: "reason", message: "Choose a reason." });
    if (details.length > 500 || (reason === "other" && details.length < 5)) issues.push({ path: "details", message: reason === "other" ? "Tell us what is wrong (5–500 characters)." : "Keep details under 500 characters." });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if ((reviews[index] as Review).status === "reported") throw new MockHttpError(409, "ALREADY_REPORTED", "You already reported this review. Nantty is looking at it.");
    const updated: Review = { ...(reviews[index] as Review), status: "reported" };
    reviews[index] = updated;
    return respondWithJson(200, updated);
  });
}
