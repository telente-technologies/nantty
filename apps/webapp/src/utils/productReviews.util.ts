import type { Order, OrderStatus } from "@/types/orders.type";
import type { ProductRatingSummary, RatingStar, SubmitReviewInput } from "@/types/commerce.type";

export const REVIEW_TEXT_MAX_BYTES = 2000;
export const REVIEW_TITLE_MAX_BYTES = 120;

const REVIEWABLE_STATUSES: readonly OrderStatus[] = ["delivered", "completed"];
const STARS: readonly RatingStar[] = ["5", "4", "3", "2", "1"];

export const utf8ByteLength = (value: string) => new TextEncoder().encode(value).byteLength;

export const starsLabel = (rating: number) => {
  const rounded = Math.round(rating * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} out of 5 stars`;
};

export const filledStarCount = (rating: number) => Math.max(0, Math.min(5, Math.round(rating)));

export function ratingBreakdown(summary: Pick<ProductRatingSummary, "count" | "distribution">) {
  const total = STARS.reduce((sum, star) => sum + (summary.distribution[star] ?? 0), 0) || summary.count;
  return STARS.map((star) => {
    const count = summary.distribution[star] ?? 0;
    return { star, count, share: total > 0 ? count / total : 0 };
  });
}

export const isOrderReviewable = (order: Pick<Order, "status">) => REVIEWABLE_STATUSES.includes(order.status);

export interface ReviewDraft {
  readonly rating: number;
  readonly text: string;
  readonly title: string;
}

export interface ReviewDraftErrors {
  readonly rating?: string;
  readonly text?: string;
  readonly title?: string;
}

export function validateReviewDraft(draft: ReviewDraft): ReviewDraftErrors {
  const errors: { rating?: string; text?: string; title?: string } = {};
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) errors.rating = "Tap a star to rate this product.";
  const text = draft.text.trim();
  if (text.length < 1) errors.text = "Write a few words about the product.";
  else if (utf8ByteLength(text) > REVIEW_TEXT_MAX_BYTES) errors.text = `Keep your review under ${REVIEW_TEXT_MAX_BYTES} characters.`;
  if (utf8ByteLength(draft.title.trim()) > REVIEW_TITLE_MAX_BYTES) errors.title = `Keep the title under ${REVIEW_TITLE_MAX_BYTES} characters.`;
  return errors;
}

export const hasDraftErrors = (errors: ReviewDraftErrors) => Boolean(errors.rating || errors.text || errors.title);

export const toSubmitReviewInput = (draft: ReviewDraft): SubmitReviewInput => {
  const title = draft.title.trim();
  return { rating: draft.rating, text: draft.text.trim(), title: title.length > 0 ? title : null };
};

export type ReviewSubmitOutcome = "already_reviewed" | "not_eligible" | "invalid" | "failed";

export function classifyReviewSubmitError(error: unknown): { readonly outcome: ReviewSubmitOutcome; readonly message: string } {
  const failure = (error ?? {}) as { readonly status?: unknown; readonly code?: unknown };
  if (typeof failure.status === "number" && failure.status > 0) {
    if (failure.status === 409 || failure.code === "ALREADY_REVIEWED") return { outcome: "already_reviewed", message: "You've already reviewed this product." };
    if (failure.code === "REVIEW_REQUIRES_PURCHASE" || failure.status === 403) return { outcome: "not_eligible", message: "You can review this once your order for it is delivered." };
    if (failure.status === 400 || failure.status === 422) return { outcome: "invalid", message: "Check your rating and review, then try again." };
  }
  return { outcome: "failed", message: "Couldn't post your review. Check your connection and try again." };
}
