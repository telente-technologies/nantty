import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const ShippingAddressSchema = schema.object({
  fullName: schema.string().min(2).max(120),
  phone: schema.string().min(7).max(20),
  line1: schema.string().min(3).max(200),
  line2: schema.string().max(200).optional(),
  city: schema.string().min(2).max(80),
  state: schema.string().min(2).max(80),
  country: schema.string().length(2).optional(),
});

export const CheckoutBodySchema = schema.object({ shippingAddress: ShippingAddressSchema });

export const OrderParamsSchema = schema.object({ id: schema.string().uuid() });

export const StoreParamsSchema = schema.object({ storeId: schema.string().uuid() });

export const StoreOrderParamsSchema = schema.object({ storeId: schema.string().uuid(), id: schema.string().uuid() });

export const ShipOrderBodySchema = schema.object({ trackingNumber: schema.string().max(80).optional() });

export const ListBuyerOrdersQuerySchema = schema.object({
  status: schema.enum(["all", "pending", "shipped", "delivered"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const ListStoreOrdersQuerySchema = schema.object({
  status: schema.enum(["pending_payment", "paid", "shipped", "delivered", "completed", "disputed", "cancelled", "refunded"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type ShippingAddressInput = Infer<typeof ShippingAddressSchema>;
