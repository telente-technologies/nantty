import { schema } from "@zudojs/schema";

import { MAXIMUM_CART_LINE_QUANTITY, SALE_ATTRIBUTION_SOURCES } from "../models/carts.model.js";

const quantity = schema.number().int().min(1).max(MAXIMUM_CART_LINE_QUANTITY);

export const AddCartItemBodySchema = schema.object({
  productId: schema.string().uuid(),
  quantity,
  size: schema.string().min(1).max(40).optional(),
  color: schema.string().min(1).max(40).optional(),
  attribution: schema.object({ source: schema.enum(SALE_ATTRIBUTION_SOURCES), id: schema.string().uuid() }).optional(),
});

export const UpdateCartItemBodySchema = schema.object({ quantity });

export const CartItemParamsSchema = schema.object({ id: schema.string().uuid() });
