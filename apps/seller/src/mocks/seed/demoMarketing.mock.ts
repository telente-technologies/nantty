import type { Product } from "@/types/catalog.type";
import type { FeaturedProduct, FlashSale, MarketingProductOption, ProductBundle } from "@/types/marketing.type";
import type { CurrencyCode, Money } from "@/types/money.type";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

export function convertProductToMarketingOption(product: Product): MarketingProductOption {
  const firstVariant = product.variants[0];
  return { productId: product.id, name: product.name, imageUrl: product.images[0]?.url ?? null, price: firstVariant?.price ?? { amountMinor: 0, currency: "NGN" } };
}

function roundMinorToHundredMajor(amountMinor: number): number {
  return Math.round(amountMinor / 10_000) * 10_000;
}

function hoursFromNowIso(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export interface DemoMarketingState {
  flashSales: FlashSale[];
  bundles: ProductBundle[];
  featuredProducts: FeaturedProduct[];
}

export function buildDemoMarketingState(products: readonly Product[], currency: CurrencyCode): DemoMarketingState {
  const options = products.filter((product) => product.status === "active").map(convertProductToMarketingOption);
  const money = (amountMinor: number): Money => ({ amountMinor, currency });
  const pick = (index: number) => options[index % Math.max(1, options.length)];
  if (options.length === 0) return { flashSales: [], bundles: [], featuredProducts: [] };
  const buildFlashItem = (index: number, discountPercent: number, stockCap: number | null, soldCount: number) => {
    const option = pick(index) as MarketingProductOption;
    return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, originalPrice: option.price, salePrice: money(roundMinorToHundredMajor((option.price.amountMinor * (100 - discountPercent)) / 100)), stockCap, soldCount };
  };
  const flashSaleDrafts: FlashSale[] = [
    { id: "flash_payday", name: "Payday Friday flash sale", items: [buildFlashItem(0, 25, 40, 27), buildFlashItem(4, 20, 25, 11)], startsAt: hoursFromNowIso(-3), endsAt: hoursFromNowIso(9), status: "active", reach: 4_820, revenue: money(0), createdAt: buildIsoDateDaysAgo(4) },
    { id: "flash_weekend", name: "Weekend owambe drop", items: [buildFlashItem(7, 15, 30, 0), buildFlashItem(11, 30, 15, 0)], startsAt: hoursFromNowIso(52), endsAt: hoursFromNowIso(76), status: "scheduled", reach: 0, revenue: money(0), createdAt: buildIsoDateDaysAgo(1) },
    { id: "flash_independence", name: "Independence Day 1-hour deals", items: [buildFlashItem(2, 35, 20, 20), buildFlashItem(9, 25, null, 34)], startsAt: buildIsoDateDaysAgo(3, 10), endsAt: buildIsoDateDaysAgo(3, 22), status: "ended", reach: 9_310, revenue: money(0), createdAt: buildIsoDateDaysAgo(10) },
  ];
  const flashSales = flashSaleDrafts.map((sale): FlashSale => ({ ...sale, revenue: money(sale.items.reduce((sum, item) => sum + item.salePrice.amountMinor * item.soldCount, 0)) }));
  const buildBundleItem = (index: number, quantity: number) => {
    const option = pick(index) as MarketingProductOption;
    return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, quantity, unitPrice: option.price };
  };
  const bundleDrafts = [
    { id: "bundle_starter", name: "Weekend starter pack", description: "Our two bestsellers together for less.", items: [buildBundleItem(0, 1), buildBundleItem(1, 1)], discountPercent: 12, status: "active" as const, soldCount: 18 },
    { id: "bundle_gift", name: "Gift box for her", description: "Ready to gift, wrapped in adire paper.", items: [buildBundleItem(12, 1), buildBundleItem(10, 1)], discountPercent: 10, status: "active" as const, soldCount: 9 },
    { id: "bundle_trio", name: "Buy 3 tees, save more", description: "Mix sizes and colours.", items: [buildBundleItem(1, 3)], discountPercent: 15, status: "paused" as const, soldCount: 4 },
  ];
  const bundles: ProductBundle[] = bundleDrafts.map((draft) => {
    const regularMinor = draft.items.reduce((sum, item) => sum + item.unitPrice.amountMinor * item.quantity, 0);
    const bundleMinor = roundMinorToHundredMajor((regularMinor * (100 - draft.discountPercent)) / 100);
    return { id: draft.id, name: draft.name, description: draft.description, items: draft.items, regularPrice: money(regularMinor), bundlePrice: money(bundleMinor), status: draft.status, soldCount: draft.soldCount, revenue: money(bundleMinor * draft.soldCount), createdAt: buildIsoDateDaysAgo(20) };
  });
  const featuredProducts: FeaturedProduct[] = [0, 3, 5, 8].map((index, position) => {
    const option = pick(index) as MarketingProductOption;
    return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, price: option.price, placement: position < 3 ? "storefront" : "mart", position: position + 1, featuredSince: buildIsoDateDaysAgo(14 - position * 3), views: 2_400 - position * 410, clicks: 312 - position * 61 };
  });
  return { flashSales, bundles, featuredProducts: featuredProducts.filter((item, index, list) => list.findIndex((other) => other.productId === item.productId) === index) };
}
