import type { Cart, CartShippingQuote } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export interface AddProductToCartInput {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
}

export const cartsService = {
  fetchMyCart: () => sendRequestToWebappServer<Cart>("/api/v1/cart"),
  fetchShippingQuote: (addressId: string) => sendRequestToWebappServer<CartShippingQuote>("/api/v1/cart/shipping-quote", { method: "POST", body: { addressId } }),
  addProductToCart: (input: AddProductToCartInput) => sendRequestToWebappServer<Cart>("/api/v1/cart/items", { method: "POST", body: input }),
  changeCartItemQuantity: (cartItemId: string, quantity: number) =>
    sendRequestToWebappServer<Cart>(`/api/v1/cart/items/${cartItemId}`, { method: "PATCH", body: { quantity } }),
  removeCartItem: (cartItemId: string) => sendRequestToWebappServer<Cart>(`/api/v1/cart/items/${cartItemId}`, { method: "DELETE" }),
};
