import type { Cart } from "@/types";

import { api } from "../core/apiClient.service";

export interface AddProductToCartInput {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
  readonly variants?: Record<string, string> | null;
}

export const cartsService = {
  fetchMyCart: (addressId: string | null) =>
    addressId ? api.post<Cart>("/api/v1/cart/shipping-quote", { addressId }) : api.get<Cart>("/api/v1/cart"),
  addProductToCart: (input: AddProductToCartInput) =>
    api.post<Cart>("/api/v1/cart/items", {
      productId: input.productId,
      quantity: input.quantity,
      ...(input.size ? { size: input.size } : {}),
      ...(input.color ? { color: input.color } : {}),
      ...(input.variants && Object.keys(input.variants).length > 0 ? { options: input.variants } : {}),
    }),
  changeCartItemQuantity: (cartItemId: string, quantity: number) => api.patch<Cart>(`/api/v1/cart/items/${cartItemId}`, { quantity }),
  removeCartItem: (cartItemId: string) => api.delete<Cart>(`/api/v1/cart/items/${cartItemId}`),
};
