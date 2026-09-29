"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

import { createIdempotencyKey } from "@/services/clientApi.service";
import type { Product, ProductVariant } from "@/types/catalog.type";
import type { DiscountInput } from "@/types/pos.type";
import type { PosCartCustomer, PosCartState, PromotionCodeValidation } from "@/types/posExtra.type";
import type { StoreSettings } from "@/types/store.type";
import { calculateCartTotalsInMinorUnits, type PricedCart } from "@/utils/posCartPricing.util";

type PosCartAction =
  | { type: "addVariant"; product: Product; variant: ProductVariant; quantity: number }
  | { type: "setQuantity"; lineId: string; quantity: number }
  | { type: "removeLine"; lineId: string }
  | { type: "setLineDiscount"; lineId: string; discount: DiscountInput | null }
  | { type: "setCartDiscount"; discount: DiscountInput | null }
  | { type: "setCustomer"; customer: PosCartCustomer | null }
  | { type: "setCoupon"; coupon: PromotionCodeValidation | null }
  | { type: "setLoyaltyPoints"; points: number }
  | { type: "replaceCart"; cart: PosCartState }
  | { type: "startNewSale" };

export const maximumQuantityPerLine = 9999;

export function createEmptyPosCart(): PosCartState {
  return { clientSaleId: createIdempotencyKey("pos"), lines: [], cartDiscount: null, customer: null, coupon: null, loyaltyPointsToRedeem: 0 };
}

function reducePosCart(state: PosCartState, action: PosCartAction): PosCartState {
  switch (action.type) {
    case "addVariant": {
      const existingLine = state.lines.find((line) => line.variantId === action.variant.id && !line.discount);
      if (existingLine) {
        return { ...state, lines: state.lines.map((line) => (line === existingLine ? { ...line, quantity: Math.min(line.quantity + action.quantity, maximumQuantityPerLine) } : line)) };
      }
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            lineId: createIdempotencyKey("line"),
            productId: action.product.id,
            variantId: action.variant.id,
            name: action.product.name,
            variantTitle: action.variant.title,
            sku: action.variant.sku,
            imageUrl: action.product.images[0]?.url ?? null,
            unitPriceMinor: action.variant.price.amountMinor,
            quantity: action.quantity,
            taxable: action.product.taxable,
            categoryId: action.product.categoryId,
            discount: null,
          },
        ],
      };
    }
    case "setQuantity":
      if (action.quantity <= 0) return { ...state, lines: state.lines.filter((line) => line.lineId !== action.lineId) };
      return { ...state, lines: state.lines.map((line) => (line.lineId === action.lineId ? { ...line, quantity: Math.min(Math.floor(action.quantity), maximumQuantityPerLine) } : line)) };
    case "removeLine":
      return { ...state, lines: state.lines.filter((line) => line.lineId !== action.lineId) };
    case "setLineDiscount":
      return { ...state, lines: state.lines.map((line) => (line.lineId === action.lineId ? { ...line, discount: action.discount } : line)) };
    case "setCartDiscount":
      return { ...state, cartDiscount: action.discount };
    case "setCustomer":
      return { ...state, customer: action.customer, loyaltyPointsToRedeem: 0 };
    case "setCoupon":
      return { ...state, coupon: action.coupon };
    case "setLoyaltyPoints":
      return { ...state, loyaltyPointsToRedeem: Math.max(0, Math.floor(action.points)) };
    case "replaceCart":
      return action.cart;
    case "startNewSale":
      return createEmptyPosCart();
  }
}

export function calculatePricedCartForSettings(cart: PosCartState, settings: StoreSettings): PricedCart {
  return calculateCartTotalsInMinorUnits({
    currency: settings.currency,
    lines: cart.lines.map((line) => ({ unitPriceMinor: line.unitPriceMinor, quantity: line.quantity, taxable: line.taxable, categoryId: line.categoryId, discount: line.discount })),
    cartDiscount: cart.cartDiscount,
    couponDiscount: cart.coupon?.discount ?? null,
    loyaltyRedemptionMinor: cart.loyaltyPointsToRedeem * settings.loyalty.redeemValuePerPoint.amountMinor,
    taxes: settings.taxes,
    pricesIncludeTax: settings.pricesIncludeTax,
  });
}

function readPersistedCart(storageKey: string): PosCartState | null {
  try {
    const storedText = window.localStorage.getItem(storageKey);
    const parsed = storedText ? (JSON.parse(storedText) as PosCartState) : null;
    return parsed && Array.isArray(parsed.lines) && typeof parsed.clientSaleId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function usePosCart(registerId: string | null, settings: StoreSettings | null) {
  const [cart, dispatch] = useReducer(reducePosCart, undefined, createEmptyPosCart);
  const storageKey = registerId ? `zudomartPosCart:${registerId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const persistedCart = readPersistedCart(storageKey);
    if (persistedCart) dispatch({ type: "replaceCart", cart: persistedCart });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      return;
    }
  }, [cart, storageKey]);

  const pricedCart = useMemo(() => (settings ? calculatePricedCartForSettings(cart, settings) : null), [cart, settings]);

  const addVariantToCart = useCallback((product: Product, variant: ProductVariant, quantity = 1) => dispatch({ type: "addVariant", product, variant, quantity }), []);
  const setLineQuantity = useCallback((lineId: string, quantity: number) => dispatch({ type: "setQuantity", lineId, quantity }), []);
  const removeCartLine = useCallback((lineId: string) => dispatch({ type: "removeLine", lineId }), []);
  const setLineDiscount = useCallback((lineId: string, discount: DiscountInput | null) => dispatch({ type: "setLineDiscount", lineId, discount }), []);
  const setCartDiscount = useCallback((discount: DiscountInput | null) => dispatch({ type: "setCartDiscount", discount }), []);
  const setCartCustomer = useCallback((customer: PosCartCustomer | null) => dispatch({ type: "setCustomer", customer }), []);
  const setCartCoupon = useCallback((coupon: PromotionCodeValidation | null) => dispatch({ type: "setCoupon", coupon }), []);
  const setLoyaltyPointsToRedeem = useCallback((points: number) => dispatch({ type: "setLoyaltyPoints", points }), []);
  const replaceCart = useCallback((nextCart: PosCartState) => dispatch({ type: "replaceCart", cart: nextCart }), []);
  const startNewSale = useCallback(() => dispatch({ type: "startNewSale" }), []);

  return { cart, pricedCart, addVariantToCart, setLineQuantity, removeCartLine, setLineDiscount, setCartDiscount, setCartCustomer, setCartCoupon, setLoyaltyPointsToRedeem, replaceCart, startNewSale };
}

export type PosCartController = ReturnType<typeof usePosCart>;
