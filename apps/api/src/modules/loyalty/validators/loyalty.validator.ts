import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const LoyaltyPageQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const RedeemReferralBodySchema = schema.object({ code: schema.string().min(4).max(20).regex(/^[A-Za-z0-9]+$/) });

export const RedeemCheckoutPointsBodySchema = schema.object({ checkoutId: schema.string().uuid(), points: schema.number().int().min(1).max(100_000_000) });

export const CheckoutIdParamsSchema = schema.object({ checkoutId: schema.string().uuid() });

export const PromoIdParamsSchema = schema.object({ id: schema.string().uuid() });

export const CashbackPromoBodySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  categoryId: schema.string().uuid().optional(),
  rateBps: schema.number().int().min(1).max(5_000),
  startsAt: schema.string().datetime().optional(),
  endsAt: schema.string().datetime().optional(),
});
