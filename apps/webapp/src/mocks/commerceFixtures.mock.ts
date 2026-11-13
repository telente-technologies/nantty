import type { Cart, CartItem, Product, ProductSummary } from "@/types";
import { multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import {
  buildCatalogProductDetail,
  buildCatalogProductSummary,
  catalogProductSeeds,
  findCatalogSeedByProductId,
  productIdForKey,
} from "./productCatalog.mock";
import { storeSummaryById } from "./storeDirectory.mock";

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

export const describeVariant = (size?: string | null, color?: string | null) => [size, color].filter(Boolean).join(" • ") || null;

export const buildCartItemFromLine = (line: MockCartLine): CartItem => {
  const seed = findCatalogSeedByProductId(line.productId);
  const product = seed ? buildCatalogProductSummary(seed) : buildMockProductSummary(0);
  return { id: line.id, product, quantity: line.quantity, variant: line.variant, store: storeSummaryById(storeIdForProduct(line.productId)) };
};

export const storeIdForProduct = (productId: string) => findCatalogSeedByProductId(productId)?.storeId ?? "s_ada";

export const mockStoreCreditBalanceUsdCentsByStore: Readonly<Record<string, number>> = { s_ada: 150 };

export const summariseMockCart = (): Cart => {
  const items = mockCartState.lines.map(buildCartItemFromLine);
  const zero = convertUsdCentsToViewerCurrency(0);
  const itemsTotal = items.reduce(
    (sum, item) => ({ ...sum, amountMinor: sum.amountMinor + multiplyMoneyByQuantity(item.product.price, item.quantity).amountMinor }),
    zero,
  );
  const distinctStoreCount = new Set(mockCartState.lines.map((line) => storeIdForProduct(line.productId))).size;
  const shipping = convertUsdCentsToViewerCurrency(distinctStoreCount * SHIPPING_FEE_PER_STORE_IN_USD_CENTS);
  const storeCredit = {
    ...zero,
    amountMinor: [...new Set(mockCartState.lines.map((line) => storeIdForProduct(line.productId)))].reduce((sum, storeId) => {
      const storeSubtotal = items.filter((item) => storeIdForProduct(item.product.id) === storeId).reduce((total, item) => total + multiplyMoneyByQuantity(item.product.price, item.quantity).amountMinor, 0);
      return sum + Math.min(storeSubtotal, convertUsdCentsToViewerCurrency(mockStoreCreditBalanceUsdCentsByStore[storeId] ?? 0).amountMinor);
    }, 0),
  };
  return {
    items,
    itemsTotal,
    shopDiscount: zero,
    storeCredit,
    shipping,
    total: { ...itemsTotal, amountMinor: itemsTotal.amountMinor - storeCredit.amountMinor + shipping.amountMinor },
  };
};
