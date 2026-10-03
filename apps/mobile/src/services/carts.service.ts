import type { Cart } from "@/types";

import { api } from "./apiClient.service";

export interface AddProductToCartInput {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
}

export const cartsService = {
  fetchMyCart: (addressId: string | null) =>
    addressId ? api.post<Cart>("/api/v1/cart/shipping-quote", { addressId }) : api.get<Cart>("/api/v1/cart"),
  addProductToCart: (input: AddProductToCartInput) => api.post<Cart>("/api/v1/cart/items", input),
  changeCartItemQuantity: (cartItemId: string, quantity: number) => api.patch<Cart>(`/api/v1/cart/items/${cartItemId}`, { quantity }),
  removeCartItem: (cartItemId: string) => api.delete<Cart>(`/api/v1/cart/items/${cartItemId}`),
};
