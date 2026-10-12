import type { SaleAttribution } from "@/utils/saleAttribution.util";
import type { Cart, CartShippingQuote } from "@/types";
import { readCartFromWire, readShippingQuoteFromWire, type CartWire } from "@/utils/cartWire.util";

import { sendRequestToWebappServer } from "./clientApi.service";

export interface AddProductToCartInput {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
  readonly attribution?: SaleAttribution | null;
}

const requestCart = async (path: string, init?: Parameters<typeof sendRequestToWebappServer>[1]): Promise<Cart> => readCartFromWire(await sendRequestToWebappServer<CartWire>(path, init));

export const cartsService = {
  fetchMyCart: () => requestCart("/api/v1/cart"),
  fetchShippingQuote: async (addressId: string): Promise<CartShippingQuote> =>
    readShippingQuoteFromWire(await sendRequestToWebappServer<CartWire>("/api/v1/cart/shipping-quote", { method: "POST", body: { addressId } })),
  addProductToCart: ({ attribution, ...input }: AddProductToCartInput) => requestCart("/api/v1/cart/items", { method: "POST", body: attribution ? { ...input, attribution } : input }),
  changeCartItemQuantity: (cartItemId: string, quantity: number) => requestCart(`/api/v1/cart/items/${cartItemId}`, { method: "PATCH", body: { quantity } }),
  removeCartItem: (cartItemId: string) => requestCart(`/api/v1/cart/items/${cartItemId}`, { method: "DELETE" }),
};
