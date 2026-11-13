import type { Cart, CartItem, CartSellerGroup, GeoSelection, Money, Product, ProductSummary } from "@/types";
import { multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import {
  buildCatalogProductDetail,
  buildCatalogProductSummary,
  catalogProductSeeds,
  findCatalogSeedByProductId,
  productIdForKey,
} from "./productCatalog.mock";
import { quoteSellerShipping } from "./shippingEngine.mock";
import { findDirectoryStoreById, storeSummaryById } from "./storeDirectory.mock";

export const SHIPPING_FEE_PER_STORE_IN_USD_CENTS = 250;
export const MOCK_SHIPPING_QUOTE_REVISION = "a".repeat(64);

export const buildMockProductSummary = (index: number, name?: string, _legacyUsdCents?: number): ProductSummary => {
  const seedWithSameName = name ? catalogProductSeeds.find((seed) => seed.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]!)) : undefined;
  const seed = seedWithSameName ?? catalogProductSeeds[Math.abs(index) % catalogProductSeeds.length]!;
  return buildCatalogProductSummary(seed);
};

export const mockStore = storeSummaryById("s_ada");

export const buildMockProductDetail = (productId: string): Product =>
  buildCatalogProductDetail(productId) ?? buildCatalogProductDetail(productIdForKey("f1"))!;

interface MockCartLine {
  readonly id: string;
  readonly productId: string;
  readonly quantity: number;
  readonly variant: string | null;
}

export const mockCartState: { lines: MockCartLine[] } = {
  lines: [
    { id: "ci_1", productId: productIdForKey("g1"), quantity: 1, variant: "Black" },
    { id: "ci_2", productId: productIdForKey("b3"), quantity: 2, variant: "30ml" },
    { id: "ci_3", productId: productIdForKey("fd2"), quantity: 3, variant: "200g" },
  ],
};

export const describeVariant = (size?: string | null, color?: string | null, variants?: Record<string, string> | null) =>
  [...[size, color].filter(Boolean), ...Object.values(variants ?? {}).filter(Boolean)].join(" • ") || null;

export const buildCartItemFromLine = (line: MockCartLine): CartItem => {
  const seed = findCatalogSeedByProductId(line.productId);
  const product = seed ? buildCatalogProductSummary(seed) : buildMockProductSummary(0);
  return { id: line.id, product, quantity: line.quantity, variant: line.variant };
};

export const storeIdForProduct = (productId: string) => findCatalogSeedByProductId(productId)?.storeId ?? "s_ada";

const sumMoney = (amounts: readonly Money[], currency: Money["currency"]): Money =>
  ({ amountMinor: amounts.reduce((total, amount) => total + amount.amountMinor, 0), currency });

export const mockStoreCreditBalanceMinorByStore: Readonly<Record<string, number>> = { s_ada: 150 };

export const buildSellerGroups = (destination: GeoSelection | null): CartSellerGroup[] => {
  const zero = convertUsdCentsToViewerCurrency(0);
  const items = mockCartState.lines.map(buildCartItemFromLine);
  const storeIds = [...new Set(mockCartState.lines.map((line) => storeIdForProduct(line.productId)))];
  return storeIds.map((storeId) => {
    const groupItems = items.filter((item) => storeIdForProduct(item.product.id) === storeId);
    const subtotal = sumMoney(groupItems.map((item) => multiplyMoneyByQuantity(item.product.price, item.quantity)), zero.currency);
    const shipping = quoteSellerShipping(storeId, subtotal, destination);
    const storeCredit = { ...zero, amountMinor: Math.min(subtotal.amountMinor, mockStoreCreditBalanceMinorByStore[storeId] ?? 0) };
    const shippingFee = shipping.status === "calculated" ? shipping.fee!.amountMinor : 0;
    return {
      storeId,
      storeName: findDirectoryStoreById(storeId).name,
      items: groupItems,
      subtotal,
      discounts: zero,
      storeCredit,
      shipping,
      total: { ...subtotal, amountMinor: subtotal.amountMinor - storeCredit.amountMinor + shippingFee },
    };
  });
};

export const isGroupPayable = (group: CartSellerGroup) => group.shipping.status === "calculated";

export const summariseMockCart = (destination: GeoSelection | null = null, addressId: string | null = null): Cart => {
  const zero = convertUsdCentsToViewerCurrency(0);
  const groups = buildSellerGroups(destination);
  const countedGroups = destination ? groups.filter(isGroupPayable) : groups;
  const itemsTotal = sumMoney(countedGroups.map((group) => group.subtotal), zero.currency);
  const shipping = sumMoney(countedGroups.map((group) => group.shipping.fee ?? zero), zero.currency);
  const storeCredit = sumMoney(countedGroups.map((group) => group.storeCredit), zero.currency);
  return {
    items: groups.flatMap((group) => group.items),
    itemsTotal,
    shopDiscount: zero,
    storeCredit,
    shipping,
    total: { ...itemsTotal, amountMinor: itemsTotal.amountMinor - storeCredit.amountMinor + shipping.amountMinor },
    groups,
    addressId,
    shippingQuoteRevision: addressId ? MOCK_SHIPPING_QUOTE_REVISION : null,
    payableGroupCount: destination ? countedGroups.length : 0,
  };
};
