import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CreatorMonetizationController } from "../controllers/creatorMonetization.controller.js";
import { BrandDealBodySchema, ConvertEarnedCoinsBodySchema, IdParamsSchema, PageQuerySchema, SendLiveGiftBodySchema, SendTipBodySchema } from "../validators/creators.validator.js";

const TAG = "creators";
const CREATORS = "/api/v1/creators";

export function registerCreatorMonetizationRoutes(router: HttpRouter, controller: CreatorMonetizationController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const spendCoins = guard.requirePermission("social:write", requireIdempotencyKey);
  const write = guard.requirePermission("social:write");
  router.post("/api/v1/posts/:id/gifts", controller.sendPostGift, {
    ...spendCoins,
    ...describeRoute(TAG, "Send a gift paid in coins to a post's creator (Idempotency-Key required)", { params: IdParamsSchema, body: SendLiveGiftBodySchema }),
  });
  router.post("/api/v1/tips", controller.sendTip, { ...spendCoins, ...describeRoute(TAG, "Tip a post, clip or live in coins (Idempotency-Key required)", { body: SendTipBodySchema }) });
  router.post(`${CREATORS}/earnings/convert`, controller.convertEarnedCoins, {
    ...guard.requirePermission("wallet:use", requireIdempotencyKey),
    ...describeRoute(TAG, "Convert earned coins into cash in my personal wallet (Idempotency-Key required)", { body: ConvertEarnedCoinsBodySchema }),
  });
  router.get(`${CREATORS}/revenue-rules`, controller.revenueRules, { ...guard.allowAnyone(), ...describeRoute(TAG, "Creator revenue shares, coin value, minimum payout and fees") });
  router.get(`${CREATORS}/brand-deals`, controller.listBrandDeals, { ...guard.requireSignedInUser(), ...describeRoute(TAG, "My recorded brand deals", { query: PageQuerySchema }) });
  router.post(`${CREATORS}/brand-deals`, controller.recordBrandDeal, { ...write, ...describeRoute(TAG, "Record a sponsorship deal with its disclosure", { body: BrandDealBodySchema }) });
  router.delete(`${CREATORS}/brand-deals/:id`, controller.removeBrandDeal, { ...write, ...describeRoute(TAG, "Remove a recorded brand deal", { params: IdParamsSchema }) });
}
