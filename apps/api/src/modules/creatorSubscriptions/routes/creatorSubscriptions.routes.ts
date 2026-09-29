import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CreatorSubscriptionsController } from "../controllers/creatorSubscriptions.controller.js";
import {
  CreatePlanBodySchema,
  CreatorIdParamsSchema,
  PlanIdParamsSchema,
  StartSubscriptionBodySchema,
  SubscriptionIdParamsSchema,
  UpdatePlanBodySchema,
  VerifySubscriptionBodySchema,
} from "../validators/creatorSubscriptions.validator.js";

const TAG = "creator-subscriptions";
const CREATORS = "/api/v1/creators";
const SUBSCRIPTIONS = "/api/v1/creator-subscriptions";

export function registerCreatorSubscriptionsRoutes(router: HttpRouter, controller: CreatorSubscriptionsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const write = guard.requirePermission("social:write");
  const member = guard.requirePermission("subscriptions:use");
  router.get(`${CREATORS}/me/subscription-plans`, controller.myPlans, { ...guard.requireSignedInUser(), ...describeRoute(TAG, "My subscription plans including inactive ones") });
  router.post(`${CREATORS}/me/subscription-plans`, controller.createPlan, { ...write, ...describeRoute(TAG, "Create a monthly or yearly plan with benefits", { body: CreatePlanBodySchema }) });
  router.patch(`${CREATORS}/me/subscription-plans/:planId`, controller.updatePlan, {
    ...write, ...describeRoute(TAG, "Rename, describe, change benefits or (de)activate my plan", { params: PlanIdParamsSchema, body: UpdatePlanBodySchema }),
  });
  router.get(`${CREATORS}/me/subscribers`, controller.mySubscribers, { ...guard.requireSignedInUser(), ...describeRoute(TAG, "People currently subscribed to me") });
  router.get(`${CREATORS}/:creatorId/subscription-plans`, controller.creatorPlans, { ...guard.allowAnyone(), ...describeRoute(TAG, "A creator's active plans", { params: CreatorIdParamsSchema }) });
  router.post(`${CREATORS}/:creatorId/subscriptions`, controller.subscribe, {
    ...guard.requirePermission("subscriptions:use", requireIdempotencyKey),
    ...describeRoute(TAG, "Subscribe to a creator via hosted checkout; renews monthly with the saved card (Idempotency-Key required)", { params: CreatorIdParamsSchema, body: StartSubscriptionBodySchema }),
  });
  router.get(SUBSCRIPTIONS, controller.mine, { ...member, ...describeRoute(TAG, "My creator subscriptions") });
  router.post(`${SUBSCRIPTIONS}/verify`, controller.verify, { ...member, ...describeRoute(TAG, "Verify a creator subscription payment with the provider", { body: VerifySubscriptionBodySchema }) });
  router.get(`${SUBSCRIPTIONS}/:id`, controller.get, { ...member, ...describeRoute(TAG, "A creator subscription's state (subscriber or creator only)", { params: SubscriptionIdParamsSchema }) });
  router.post(`${SUBSCRIPTIONS}/:id/cancel`, controller.cancel, { ...member, ...describeRoute(TAG, "Stop renewing; access continues until the period ends", { params: SubscriptionIdParamsSchema }) });
  router.post(`${SUBSCRIPTIONS}/:id/resume`, controller.resume, { ...member, ...describeRoute(TAG, "Resume renewing before the period ends", { params: SubscriptionIdParamsSchema }) });
}
