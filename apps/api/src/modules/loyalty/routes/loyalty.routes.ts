import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { LoyaltyController } from "../controllers/loyalty.controller.js";
import {
  CashbackPromoBodySchema,
  CheckoutIdParamsSchema,
  LoyaltyPageQuerySchema,
  PromoIdParamsSchema,
  RedeemCheckoutPointsBodySchema,
  RedeemReferralBodySchema,
} from "../validators/loyalty.validator.js";

const TAG = "loyalty";

export function registerLoyaltyRoutes(router: HttpRouter, controller: LoyaltyController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const signedIn = guard.requireSignedInUser();
  const buyer = guard.requirePermission("orders:place");
  router.get("/api/v1/loyalty/me", controller.summary, { ...signedIn, ...describeRoute(TAG, "My loyalty points, tier and cashback") });
  router.get("/api/v1/loyalty/history", controller.history, { ...signedIn, ...describeRoute(TAG, "My points, cashback and referral reward history", { query: LoyaltyPageQuerySchema }) });
  router.post("/api/v1/loyalty/redemptions", controller.redeemPoints, {
    ...guard.requirePermission("orders:place", requireIdempotencyKey),
    ...describeRoute(TAG, "Use points as a discount on a checkout before paying (Idempotency-Key required)", { body: RedeemCheckoutPointsBodySchema }),
  });
  router.delete("/api/v1/loyalty/redemptions/:checkoutId", controller.releasePoints, { ...buyer, ...describeRoute(TAG, "Return points applied to an unpaid checkout", { params: CheckoutIdParamsSchema }) });
  router.get("/api/v1/referrals/me", controller.referrals, { ...signedIn, ...describeRoute(TAG, "My referral code, rewards and invited friends") });
  router.post("/api/v1/referrals/redeem", controller.redeemReferral, { ...buyer, ...describeRoute(TAG, "Use a friend's referral code before your first order", { body: RedeemReferralBodySchema }) });
  const admin = guard.requirePermission("monetization:manage");
  router.get("/api/v1/admin/cashback-promos", controller.listPromos, { ...admin, ...describeRoute(TAG, "List cashback promos") });
  router.post("/api/v1/admin/cashback-promos", controller.createPromo, { ...admin, ...describeRoute(TAG, "Create a store or category cashback promo", { body: CashbackPromoBodySchema }) });
  router.delete("/api/v1/admin/cashback-promos/:id", controller.deactivatePromo, { ...admin, ...describeRoute(TAG, "End a cashback promo", { params: PromoIdParamsSchema }) });
}
