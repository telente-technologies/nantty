import type { PurchasableVariant } from "../../../interfaces/productCatalog.interface.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { Kobo } from "../../../types/money.type.js";
import { calculateBasisPointsShare, multiplyKoboByQuantity, sumKoboAmounts } from "../../../utils/money.util.js";

export interface PricedCartLine {
  readonly variant: PurchasableVariant;
  readonly quantity: number;
  readonly lineTotal: Kobo;
}

export interface PricedStoreGroup {
  readonly store: StoreSummary;
  readonly lines: readonly PricedCartLine[];
  readonly itemsTotal: Kobo;
  readonly shopDiscount: Kobo;
  readonly shipping: Kobo;
  readonly total: Kobo;
}

export interface CartTotals {
  readonly itemsTotal: Kobo;
  readonly shopDiscount: Kobo;
  readonly shipping: Kobo;
  readonly estimatedTotal: Kobo;
  readonly currency: string;
}

export function priceStoreGroup(store: StoreSummary, lines: readonly PricedCartLine[]): PricedStoreGroup {
  const itemsTotal = sumKoboAmounts(lines.map((line) => line.lineTotal));
  const shopDiscount = calculateBasisPointsShare(itemsTotal, Math.min(Math.max(store.discountBps, 0), 10_000));
  const shipping = lines.length === 0 ? 0 : store.shippingFee;
  return { store, lines, itemsTotal, shopDiscount, shipping, total: itemsTotal - shopDiscount + shipping };
}

export function priceCartLine(variant: PurchasableVariant, quantity: number): PricedCartLine {
  return { variant, quantity, lineTotal: multiplyKoboByQuantity(variant.unitPrice, quantity) };
}

export function calculateCartTotalsInKobo(groups: readonly PricedStoreGroup[], currency: string): CartTotals {
  return {
    itemsTotal: sumKoboAmounts(groups.map((group) => group.itemsTotal)),
    shopDiscount: sumKoboAmounts(groups.map((group) => group.shopDiscount)),
    shipping: sumKoboAmounts(groups.map((group) => group.shipping)),
    estimatedTotal: sumKoboAmounts(groups.map((group) => group.total)),
    currency,
  };
}
