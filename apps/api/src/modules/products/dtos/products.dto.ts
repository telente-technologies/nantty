import type { MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { MoneyDto } from "../../../utils/money.util.js";
import type { ProductRecord, ProductVariantRecord } from "../models/products.model.js";
import { presentPriceInCurrency } from "./price.dto.js";

export function convertVariantToDto(variant: ProductVariantRecord, product: ProductRecord, convert: MoneyConversion) {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    price: presentPriceInCurrency(variant.price, product.currency, convert),
    stock: variant.stock,
  };
}

export function convertProductToCardDto(product: ProductRecord, convert: MoneyConversion) {
  return {
    id: product.id,
    storeId: product.storeId,
    title: product.title,
    price: presentPriceInCurrency(product.price, product.currency, convert),
    compareAtPrice: product.compareAtPrice === null ? null : presentPriceInCurrency(product.compareAtPrice, product.currency, convert),
    storeCurrency: product.currency,
    imageUrl: product.images[0] ?? null,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    salesCount: product.salesCount,
  };
}

export function describeStockLevel(totalStock: number): string {
  return totalStock > 0 ? `${totalStock} in stock` : "Out of stock";
}

export function convertProductToDetailDto(product: ProductRecord, variants: readonly ProductVariantRecord[], convert: MoneyConversion) {
  const totalStock = variants.reduce((total, variant) => total + variant.stock, 0);
  return {
    ...convertProductToCardDto(product, convert),
    categoryId: product.categoryId,
    slug: product.slug,
    description: product.description,
    status: product.status,
    images: product.images,
    shippingInfo: product.shippingInfo,
    returnsInfo: product.returnsInfo,
    sizes: [...new Set(variants.map((variant) => variant.size).filter((size): size is string => size !== null))],
    colors: [...new Set(variants.map((variant) => variant.color).filter((color): color is string => color !== null))],
    variants: variants.map((variant) => convertVariantToDto(variant, product, convert)),
    totalStock,
    stockLabel: describeStockLevel(totalStock),
    publishedAt: product.publishedAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function convertStoreSummaryToShopDto(store: StoreSummary, convert: MoneyConversion) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logoUrl: store.logoUrl,
    ratingAverage: store.ratingAverage,
    ratingCount: store.ratingCount,
    currency: store.currency,
    shippingFee: presentPriceInCurrency(store.shippingFee, store.currency, convert),
    discountBps: store.discountBps,
  };
}

export type ProductCardDto = ReturnType<typeof convertProductToCardDto>;
export type ProductDetailDto = ReturnType<typeof convertProductToDetailDto>;
export type ShopDto = ReturnType<typeof convertStoreSummaryToShopDto>;

export interface PublicProductDetailDto extends ProductDetailDto {
  readonly shop: ShopDto;
  readonly featuredWith: readonly ProductCardDto[];
}

export interface MartHomeDto {
  readonly currency: MoneyDto["currency"];
  readonly salesOfTheDay: readonly (ProductCardDto & { readonly discountPercent: number })[];
  readonly featuredBrands: readonly ShopDto[];
  readonly newArrivals: readonly ProductCardDto[];
}
