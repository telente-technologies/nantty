import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyReviewSubmitError, isOrderReviewable, ratingBreakdown, starsLabel, toSubmitReviewInput, validateReviewDraft } from "./productReviews.util";

describe("product reviews", () => {
  it("only offers reviews after delivery", () => {
    assert.equal(isOrderReviewable({ status: "delivered" }), true);
    assert.equal(isOrderReviewable({ status: "completed" }), true);
    assert.equal(isOrderReviewable({ status: "shipped" }), false);
  });

  it("validates like the app", () => {
    assert.deepEqual(validateReviewDraft({ rating: 0, text: " ", title: "" }), { rating: "Tap a star to rate this product.", text: "Write a few words about the product." });
    assert.equal(validateReviewDraft({ rating: 5, text: "é".repeat(1001), title: "" }).text, "Keep your review under 2000 characters.");
    assert.deepEqual(toSubmitReviewInput({ rating: 4, text: "  Good  ", title: "  " }), { rating: 4, text: "Good", title: null });
  });

  it("maps the catalog service errors to the app's outcomes", () => {
    assert.equal(classifyReviewSubmitError({ status: 409, code: "ALREADY_REVIEWED" }).outcome, "already_reviewed");
    assert.equal(classifyReviewSubmitError({ status: 403, code: "REVIEW_REQUIRES_PURCHASE" }).outcome, "not_eligible");
    assert.equal(classifyReviewSubmitError({ status: 400, code: "VALIDATION_FAILED" }).outcome, "invalid");
    assert.equal(classifyReviewSubmitError({ status: 0, code: "NETWORK_UNAVAILABLE" }).outcome, "failed");
  });

  it("builds the star breakdown", () => {
    const rows = ratingBreakdown({ count: 4, distribution: { "1": 0, "2": 0, "3": 1, "4": 1, "5": 2 } });
    assert.equal(rows[0]?.star, "5");
    assert.equal(rows[0]?.share, 0.5);
    assert.equal(starsLabel(4.25), "4.3 out of 5 stars");
  });
});
