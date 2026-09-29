import { schema } from "@zudojs/schema";

import { MAXIMUM_CART_LINE_QUANTITY } from "../models/carts.model.js";

const quantity = schema.number().int().min(1).max(MAXIMUM_CART_LINE_QUANTITY);

export const AddCartItemBodySchema = schema.object({
  productId: schema.string().uuid(),
  quantity,
  size: schema.string().min(1).max(40).optional(),
  color: schema.string().min(1).max(40).optional(),
});

export const UpdateCartItemBodySchema = schema.object({ quantity });

export const CartItemParamsSchema = schema.object({ id: schema.string().uuid() });
