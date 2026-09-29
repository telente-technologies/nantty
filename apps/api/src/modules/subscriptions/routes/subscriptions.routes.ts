import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { SellerSubscriptionsController } from "../controllers/sellerSubscriptions.controller.js";
import type { SubscriptionPlansAdminController } from "../controllers/subscriptionPlansAdmin.controller.js";
import type { SubscriptionsController } from "../controllers/subscriptions.controller.js";
import {
  ChangePlanBodySchema,
  ListSubscriptionsQuerySchema,
  PersonalCheckoutBodySchema,
  PlanParamsSchema,
  ProfileParamsSchema,
  ReplaceEntitlementsBodySchema,
  ReplacePerksBodySchema,
  ReplacePricesBodySchema,
  SellerCheckoutBodySchema,
  StoreScopeQuerySchema,
  UpdatePlanBodySchema,
  VerifySubscriptionBodySchema,
} from "../validators/subscriptions.validator.js";

const BASE = "/api/v1/subscriptions";
const SELLER = "/api/v1/seller/subscription";
const PLANS = "/api/v1/admin/subscription-plans";
const TAG = "subscriptions";

export interface SubscriptionControllers {
  readonly subscriptions: SubscriptionsController;
  readonly seller: SellerSubscriptionsController;
  readonly plansAdmin: SubscriptionPlansAdminController;
}

export function registerSubscriptionsRoutes(router: HttpRouter, controllers: SubscriptionControllers, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const { subscriptions, seller, plansAdmin } = controllers;
  const member = guard.requirePermission("subscriptions:use");
  const admin = guard.requirePermission("subscriptions:manage");
  const sellerOwner = guard.requirePermission("stores:manage");
  const profile = { params: ProfileParamsSchema };

  router.get(`${BASE}/plans`, subscriptions.listPlans, { ...guard.allowAnyone(), ...describeRoute(TAG, "List Blue personal plans in my display currency") });
  router.post(`${BASE}/checkout`, subscriptions.checkout, {
    ...guard.requirePermission("subscriptions:use", requireIdempotencyKey),
    ...describeRoute(TAG, "Start a Blue plan: free trial or provider checkout (Idempotency-Key required)", { body: PersonalCheckoutBodySchema }),
  });
  router.post(`${BASE}/verify`, subscriptions.verify, { ...member, ...describeRoute(TAG, "Verify a subscription payment with the provider", { body: VerifySubscriptionBodySchema }) });
  router.get(`${BASE}/me`, subscriptions.getMine, { ...member, ...describeRoute(TAG, "Get my personal subscription") });
  router.get(BASE, subscriptions.list, { ...admin, ...describeRoute(TAG, "List subscriptions", { query: ListSubscriptionsQuerySchema }) });
  router.get(`${BASE}/:profileId`, subscriptions.getPublic, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a profile's public subscription tier", profile) });
  router.post(`${BASE}/:profileId/cancel`, subscriptions.cancel, { ...member, ...describeRoute(TAG, "Cancel my (or my store's) subscription at period end", profile) });
  router.post(`${BASE}/:profileId/resume`, subscriptions.resume, { ...member, ...describeRoute(TAG, "Resume a cancelled subscription before it ends", profile) });
  router.post(`${BASE}/:profileId/upgrade`, subscriptions.upgrade, { ...admin, ...describeRoute(TAG, "Upgrade a subscription plan", { ...profile, body: ChangePlanBodySchema }) });
  router.post(`${BASE}/:profileId/downgrade`, subscriptions.downgrade, { ...admin, ...describeRoute(TAG, "Downgrade a subscription plan", { ...profile, body: ChangePlanBodySchema }) });
  router.post(`${BASE}/:profileId/expire`, subscriptions.expire, { ...admin, ...describeRoute(TAG, "Expire a subscription", profile) });
  router.post(`${BASE}/:profileId/suspend`, subscriptions.suspend, { ...admin, ...describeRoute(TAG, "Suspend a subscription", profile) });
  router.post(`${BASE}/:profileId/reinstate`, subscriptions.adminResume, { ...admin, ...describeRoute(TAG, "Resume a suspended subscription", profile) });
  router.post(`${BASE}/:profileId/past-due`, subscriptions.markPastDue, { ...admin, ...describeRoute(TAG, "Mark a subscription past due", profile) });

  router.get("/api/v1/seller/access", seller.access, { ...guard.requirePermission("orders:fulfil"), ...describeRoute(TAG, "My store's verification, Gold subscription and role", { query: StoreScopeQuerySchema }) });
  router.get(`${SELLER}/plans`, seller.listPlans, { ...sellerOwner, ...describeRoute(TAG, "List Gold plans priced in my store's currency", { query: StoreScopeQuerySchema }) });
  router.get(SELLER, seller.getSubscription, { ...sellerOwner, ...describeRoute(TAG, "Get my store's Gold subscription", { query: StoreScopeQuerySchema }) });
  router.post(`${SELLER}/checkout`, seller.checkout, {
    ...guard.requirePermission("stores:manage", requireIdempotencyKey),
    ...describeRoute(TAG, "Start a Gold plan for my store (Idempotency-Key required)", { query: StoreScopeQuerySchema, body: SellerCheckoutBodySchema }),
  });
  router.post(`${SELLER}/verify`, seller.verify, { ...sellerOwner, ...describeRoute(TAG, "Verify a Gold subscription payment", { body: VerifySubscriptionBodySchema }) });
  router.post(`${SELLER}/cancel`, seller.cancel, { ...sellerOwner, ...describeRoute(TAG, "Cancel my store's Gold plan at period end", { query: StoreScopeQuerySchema }) });
  router.post(`${SELLER}/resume`, seller.resume, { ...sellerOwner, ...describeRoute(TAG, "Resume my store's cancelled Gold plan", { query: StoreScopeQuerySchema }) });

  router.get(PLANS, plansAdmin.list, { ...admin, ...describeRoute(TAG, "List all plans with prices, entitlements and perks") });
  router.patch(`${PLANS}/:id`, plansAdmin.update, { ...admin, ...describeRoute(TAG, "Update a plan", { params: PlanParamsSchema, body: UpdatePlanBodySchema }) });
  router.put(`${PLANS}/:id/prices`, plansAdmin.replacePrices, { ...admin, ...describeRoute(TAG, "Replace a plan's prices", { params: PlanParamsSchema, body: ReplacePricesBodySchema }) });
  router.put(`${PLANS}/:id/entitlements`, plansAdmin.replaceEntitlements, { ...admin, ...describeRoute(TAG, "Replace a plan's entitlements", { params: PlanParamsSchema, body: ReplaceEntitlementsBodySchema }) });
  router.put(`${PLANS}/:id/perks`, plansAdmin.replacePerks, { ...admin, ...describeRoute(TAG, "Replace a plan's display perks", { params: PlanParamsSchema, body: ReplacePerksBodySchema }) });
}
