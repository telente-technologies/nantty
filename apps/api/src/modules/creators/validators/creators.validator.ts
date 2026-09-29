import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const MAX_GIFT_QUANTITY = 99;
const MAX_COMMISSION_BPS = 10_000;

export const IdParamsSchema = schema.object({ id: schema.string().uuid() });

export const UserIdParamsSchema = schema.object({ userId: schema.string().uuid() });

export const PageQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const ListCreatorApplicationsQuerySchema = schema.object({
  status: schema.enum(["pending", "approved", "rejected"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const ReviewCreatorApplicationBodySchema = schema.object({
  decision: schema.enum(["approve", "reject"]),
  note: schema.string().max(1000).optional(),
});

export const CreatorStandingBodySchema = schema.object({ reason: schema.string().min(3).max(1000).optional() });

export const DashboardQuerySchema = schema.object({ period: schema.enum(["today", "week", "month", "all"]).default("week") });

export const SendLiveGiftBodySchema = schema.object({
  giftId: schema.string().min(1).max(40),
  quantity: schema.number().int().min(1).max(MAX_GIFT_QUANTITY).default(1),
});

export const AffiliateTargetBodySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  productId: schema.string().uuid().optional(),
});

export const AffiliateCommissionBodySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  productId: schema.string().uuid().optional(),
  commissionBps: schema.number().int().min(0).max(MAX_COMMISSION_BPS),
});

export const AffiliateCommissionQuerySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  productId: schema.string().uuid().optional(),
});

export type ReviewCreatorApplicationBody = Infer<typeof ReviewCreatorApplicationBodySchema>;
export type AffiliateTargetBody = Infer<typeof AffiliateTargetBodySchema>;
