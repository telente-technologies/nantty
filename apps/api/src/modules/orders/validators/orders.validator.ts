import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { PUBLIC_ORDER_STATUSES } from "../models/orders.model.js";
import { DASHBOARD_PERIODS } from "../services/storeDashboard.service.js";

const pageFields = {
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
};

export const CheckoutBodySchema = schema.object({ addressId: schema.string().uuid(), redeemLoyaltyPoints: schema.boolean().default(false) });

export const OrderParamsSchema = schema.object({ id: schema.string().uuid() });

export const ShipOrderBodySchema = schema.object({
  courier: schema.string().min(2).max(80).optional(),
  trackingNumber: schema.string().max(80).optional(),
});

export const ListBuyerOrdersQuerySchema = schema.object({
  status: schema.enum([...PUBLIC_ORDER_STATUSES, "all"]).optional(),
  ...pageFields,
});

export const ListSellerOrdersQuerySchema = schema.object({
  status: schema.enum([...PUBLIC_ORDER_STATUSES, "all"]).optional(),
  q: schema.string().min(1).max(80).optional(),
  storeId: schema.string().uuid().optional(),
  ...pageFields,
});

export const SellerDashboardQuerySchema = schema.object({
  period: schema.enum(DASHBOARD_PERIODS).optional(),
  storeId: schema.string().uuid().optional(),
});
