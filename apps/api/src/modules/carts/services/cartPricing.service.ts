import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import type { PurchasableVariant } from "../../../interfaces/productCatalog.interface.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { SaleAttribution } from "../models/carts.model.js";

export interface PricedCartLine {
  readonly cartItemId: string;
  readonly variant: PurchasableVariant;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
  readonly attribution: SaleAttribution | null;
}

export interface PricedStoreGroup {
  readonly store: StoreSummary;
  readonly lines: readonly PricedCartLine[];
  readonly itemsTotal: Money;
  readonly shopDiscount: Money;
  readonly shipping: Money;
  readonly total: Money;
}

export interface CartTotals {
  readonly itemsTotal: Money;
  readonly shopDiscount: Money;
  readonly shipping: Money;
  readonly estimatedTotal: Money;
}

export function priceCartLine(cartItemId: string, variant: PurchasableVariant, quantity: number, attribution: SaleAttribution | null = null): PricedCartLine {
  const unitPrice = Money.of(variant.unitPrice, variant.currency);
  return { cartItemId, variant, quantity, unitPrice, lineTotal: unitPrice.multiplyByQuantity(quantity), attribution };
}

export function priceStoreGroup(store: StoreSummary, lines: readonly PricedCartLine[]): PricedStoreGroup {
  const itemsTotal = Money.sum(lines.map((line) => line.lineTotal), store.currency);
  const shopDiscount = itemsTotal.calculateBasisPointsShareRoundingDown(Math.min(Math.max(store.discountBps, 0), 10_000));
  const shipping = lines.length === 0 ? Money.zero(store.currency) : Money.of(store.shippingFee, store.currency);
  return { store, lines, itemsTotal, shopDiscount, shipping, total: itemsTotal.subtract(shopDiscount).add(shipping) };
}

export function convertPricedStoreGroupInto(group: PricedStoreGroup, convert: MoneyConversion): PricedStoreGroup {
  return {
    store: group.store,
    lines: group.lines.map((line) => ({ ...line, unitPrice: convert(line.unitPrice), lineTotal: convert(line.lineTotal) })),
    itemsTotal: convert(group.itemsTotal),
    shopDiscount: convert(group.shopDiscount),
    shipping: convert(group.shipping),
    total: convert(group.total),
  };
}

export function calculateCartTotalsInDisplayCurrency(groups: readonly PricedStoreGroup[], displayCurrency: CurrencyCode): CartTotals {
  return {
    itemsTotal: Money.sum(groups.map((group) => group.itemsTotal), displayCurrency),
    shopDiscount: Money.sum(groups.map((group) => group.shopDiscount), displayCurrency),
    shipping: Money.sum(groups.map((group) => group.shipping), displayCurrency),
    estimatedTotal: Money.sum(groups.map((group) => group.total), displayCurrency),
  };
}
