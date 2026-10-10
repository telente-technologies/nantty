import { ApiError } from "@/errors/api.error";
import type { Order } from "@/types";
import {
  REVIEW_TEXT_MAX_BYTES,
  classifyReviewSubmitError,
  hasDraftErrors,
  isOrderReviewable,
  ratingBreakdown,
  reviewableProductsInOrder,
  starsLabel,
  toSubmitReviewInput,
  validateReviewDraft,
} from "@/utils/productReviews.util";

const orderWith = (status: Order["status"], productIds: string[]) =>
  ({ status, items: productIds.map((id, index) => ({ id: `i${index}`, quantity: 1, variant: null, product: { id, name: id, imageUrl: null } })) }) as unknown as Order;

describe("rating summary", () => {
  it("orders the breakdown 5 to 1 with shares of the total", () => {
    const rows = ratingBreakdown({ count: 10, distribution: { "1": 1, "2": 0, "3": 1, "4": 2, "5": 6 } });
    expect(rows.map((row) => row.star)).toEqual(["5", "4", "3", "2", "1"]);
    expect(rows[0]).toEqual({ star: "5", count: 6, share: 0.6 });
    expect(rows[3]!.share).toBe(0);
  });

  it("handles an empty summary without dividing by zero", () => {
    const rows = ratingBreakdown({ count: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } });
    expect(rows.every((row) => row.share === 0)).toBe(true);
  });

  it("labels stars for screen readers", () => {
    expect(starsLabel(4)).toBe("4 out of 5 stars");
    expect(starsLabel(4.26)).toBe("4.3 out of 5 stars");
  });
});

describe("eligibility gating", () => {
  it("only delivered or completed orders can be reviewed", () => {
    expect(isOrderReviewable({ status: "delivered" })).toBe(true);
    expect(isOrderReviewable({ status: "completed" })).toBe(true);
    for (const status of ["pending", "paid", "shipped", "cancelled", "disputed"] as const) expect(isOrderReviewable({ status })).toBe(false);
  });

  it("hides products already reviewed and de-duplicates repeats", () => {
    const products = reviewableProductsInOrder(orderWith("completed", ["a", "b", "a", "c"]), new Set(["b"]));
    expect(products.map((product) => product.id)).toEqual(["a", "c"]);
    expect(reviewableProductsInOrder(orderWith("shipped", ["a"]), new Set())).toEqual([]);
  });
});

describe("review draft validation", () => {
  it("needs a star rating and some text", () => {
    const errors = validateReviewDraft({ rating: 0, text: "   ", title: "" });
    expect(errors.rating).toBeTruthy();
    expect(errors.text).toBeTruthy();
    expect(hasDraftErrors(validateReviewDraft({ rating: 4, text: "Good", title: "" }))).toBe(false);
  });

  it("matches the backend byte limits", () => {
    expect(validateReviewDraft({ rating: 5, text: "a".repeat(REVIEW_TEXT_MAX_BYTES), title: "" }).text).toBeUndefined();
    expect(validateReviewDraft({ rating: 5, text: "a".repeat(REVIEW_TEXT_MAX_BYTES + 1), title: "" }).text).toBeTruthy();
    expect(validateReviewDraft({ rating: 5, text: "é".repeat(1001), title: "" }).text).toBeTruthy();
    expect(validateReviewDraft({ rating: 5, text: "ok", title: "t".repeat(121) }).title).toBeTruthy();
  });

  it("trims the payload and drops an empty title", () => {
    expect(toSubmitReviewInput({ rating: 3, text: "  Fine  ", title: "  " })).toEqual({ rating: 3, text: "Fine", title: null });
  });

  it("classifies backend errors", () => {
    expect(classifyReviewSubmitError(new ApiError(409, "x", "ALREADY_REVIEWED")).outcome).toBe("already_reviewed");
    expect(classifyReviewSubmitError(new ApiError(403, "x", "REVIEW_REQUIRES_PURCHASE")).outcome).toBe("not_eligible");
    expect(classifyReviewSubmitError(new ApiError(422, "x")).outcome).toBe("invalid");
    expect(classifyReviewSubmitError(new Error("offline")).outcome).toBe("failed");
  });
});
