import { schema } from "@zudojs/schema";

import { MAXIMUM_CART_LINE_QUANTITY } from "../models/carts.model.js";

const quantity = schema.number().int().min(1).max(MAXIMUM_CART_LINE_QUANTITY);

export const AddCartItemBodySchema = schema.object({ variantId: schema.string().uuid(), quantity });

export const UpdateCartItemBodySchema = schema.object({ quantity });

export const CartItemParamsSchema = schema.object({ variantId: schema.string().uuid() });
