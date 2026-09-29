import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { ReviewsController } from "../controllers/reviews.controller.js";
import { CreateReviewBodySchema, ReplyToReviewBodySchema, ReviewListQuerySchema, ReviewParamsSchema } from "../validators/reviews.validator.js";

const TAG = "reviews";

export function registerReviewsRoutes(router: HttpRouter, controller: ReviewsController, web: WebKit): void {
  const { guard } = web;
  const anyone = guard.allowAnyone();
  const params = { params: ReviewParamsSchema };
  const listing = { params: ReviewParamsSchema, query: ReviewListQuerySchema };

  router.post("/api/v1/products/:id/reviews", controller.create, { ...guard.requirePermission("reviews:write"), ...describeRoute(TAG, "Review a product I received", { ...params, body: CreateReviewBodySchema }) });
  router.get("/api/v1/products/:id/reviews", controller.listForProduct, { ...anyone, ...describeRoute(TAG, "List product reviews", listing) });
  router.get("/api/v1/products/:id/rating-summary", controller.ratingSummary, { ...anyone, ...describeRoute(TAG, "Product rating average and distribution", params) });
  router.get("/api/v1/stores/:id/reviews", controller.listForStore, { ...anyone, ...describeRoute(TAG, "List store reviews", listing) });
  router.post("/api/v1/reviews/:id/reply", controller.reply, { ...guard.requirePermission("reviews:reply"), ...describeRoute(TAG, "Reply to a review of my store", { ...params, body: ReplyToReviewBodySchema }) });
  router.delete("/api/v1/reviews/:id", controller.remove, { ...guard.requirePermission("reviews:write"), ...describeRoute(TAG, "Delete my review", params) });
}
