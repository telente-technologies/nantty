import { minorUnitsPerMajorUnitByCurrency } from "@/constants/currency.constant";
import type { CurrencyCode } from "@/types/money.type";
import type { Product, ProductVariant, StockLevel } from "@/types/catalog.type";
import { buildEan13FromTwelveDigits } from "@/utils/ean13.util";
import type { DemoCatalogPlan } from "@/mocks/seed/demoStoreProfile.mock";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive } from "@/mocks/seed/seededRandom.mock";

export function buildUnsplashProductImageUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?w=800&q=80&fm=webp`;
}

function listEveryOptionCombination(options: readonly { readonly name: string; readonly values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (combinations, option) => combinations.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))),
    [{}],
  );
}

function buildDemoStockLevels(plan: DemoCatalogPlan, random: () => number, isLowStockVariant: boolean): StockLevel[] {
  const frontLocationId = plan.stockLocationIds[0];
  return plan.stockLocationIds.map((locationId) => {
    const isBulkLocation = locationId === plan.bulkStockLocationId;
    const onHand = isLowStockVariant && locationId === frontLocationId ? pickRandomIntegerInclusive(0, 3, random) : pickRandomIntegerInclusive(isBulkLocation ? 20 : 4, isBulkLocation ? 120 : 40, random);
    const reserved = locationId === frontLocationId ? Math.min(onHand, pickRandomIntegerInclusive(0, 2, random)) : 0;
    return { locationId, onHand, reserved };
  });
}

const demoAttributeValuesByCategoryName: Record<string, readonly [string, string][]> = {
  Fashion: [["Material", "100% cotton"], ["Made in", "Lagos, Nigeria"], ["Care", "Hand wash cold"]],
  Bags: [["Material", "Full-grain leather"], ["Dimensions", "32 × 24 × 12 cm"]],
  Jewellery: [["Material", "Gold-plated brass"], ["Length", "45 cm"]],
  "Beauty & care": [["Skin type", "All skin types"], ["Size", "As labelled"]],
  Gadgets: [["Warranty", "6 months"], ["Battery", "Up to 40 hours"]],
  Home: [["Material", "Stainless steel"], ["Care", "Hand wash"]],
};

function buildDemoProductAttributes(categoryName: string, productIndex: number): { name: string; value: string }[] {
  const candidates = demoAttributeValuesByCategoryName[categoryName] ?? [["Made in", "Nigeria"]];
  return candidates.slice(0, 1 + (productIndex % candidates.length)).map(([name, value]) => ({ name, value }));
}

export function buildDemoProductsFromCatalogPlan(plan: DemoCatalogPlan, currency: CurrencyCode, randomSeed: number): Product[] {
  const random = createSeededRandomNumberGenerator(randomSeed);
  const toMoney = (amountMajor: number) => ({ amountMinor: Math.round(amountMajor * minorUnitsPerMajorUnitByCurrency[currency]), currency });
  return plan.blueprints.map((blueprint, productIndex) => {
    const productKey = blueprint.key.replace(/-/g, "_");
    const productId = `prod_${productKey}`;
    const options = blueprint.options ?? [];
    const isHighVolume = plan.highVolumeCategoryIds.includes(blueprint.categoryId);
    const variants = listEveryOptionCombination(options).map((optionValues, variantIndex): ProductVariant => {
      const variantSuffix = Object.values(optionValues).map((value) => value.slice(0, 3).toUpperCase()).join("-");
      const barcodeBody = `${plan.barcodeCompanyDigits}${String(productIndex + 1).padStart(4, "0")}${String(variantIndex + 1).padStart(4, "0")}`;
      return {
        id: `var_${productKey}_${variantIndex + 1}`,
        productId,
        title: Object.values(optionValues).join(" / ") || "Default",
        optionValues,
        sku: `${plan.skuPrefix}-${blueprint.categoryId.slice(4, 7).toUpperCase()}-${String(productIndex + 1).padStart(3, "0")}${variantSuffix ? `-${variantSuffix}` : ""}`,
        barcode: buildEan13FromTwelveDigits(barcodeBody),
        price: toMoney(blueprint.priceMajor),
        compareAtPrice: productIndex % 7 === 3 ? toMoney(Math.round(blueprint.priceMajor * 1.2)) : null,
        costPrice: toMoney(blueprint.costMajor),
        lowStockThreshold: isHighVolume ? 12 : 5,
        reorderPoint: isHighVolume ? 15 : 6,
        reorderQuantity: isHighVolume ? 60 : 20,
        stock: buildDemoStockLevels(plan, random, (productIndex + variantIndex) % 9 === 0),
      };
    });
    return {
      id: productId,
      name: blueprint.name,
      description: blueprint.description,
      categoryId: blueprint.categoryId,
      categoryName: blueprint.categoryName,
      status: "active",
      publishedOnline: blueprint.publishedOnline ?? true,
      images: blueprint.unsplashPhotoId ? [{ mediaId: `media_${productKey}`, url: buildUnsplashProductImageUrl(blueprint.unsplashPhotoId) }] : [],
      options,
      variants,
      taxable: blueprint.taxable ?? true,
      trackInventory: true,
      tags: blueprint.tags ?? [],
      brand: plan.brandTagsByProductKey[blueprint.key] ?? null,
      visibility: productIndex % 11 === 5 ? "store_only" : "public",
      publishAt: null,
      attributes: buildDemoProductAttributes(blueprint.categoryName, productIndex),
      videos: [],
      supplierId: productIndex % 5 === 4 ? null : `sup_${(productIndex % 4) + 1}`,
      createdAt: buildIsoDateDaysAgo(120 - productIndex * 3),
      updatedAt: buildIsoDateDaysAgo(productIndex % 10),
    };
  });
}
