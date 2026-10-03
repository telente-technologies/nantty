import type { BrandSource, ProductSource, StoreSource, UserSource } from "../../../interfaces/sourceHydrator.interface.js";
import type { SearchDocument } from "../../../types/searchDocument.type.js";
import { normalizeSearchText } from "../../../utils/queryNormalizer.util.js";

const publishedStatuses = new Set(["published", "active", "live"]);
const publicVisibilities = new Set(["public", "listed"]);

export function buildUserDocument(source: UserSource, version: number): SearchDocument {
  const active = source.status === "active";
  return {
    kind: "user",
    entityId: source.accountId,
    ownerAccountId: source.accountId,
    title: source.username,
    subtitle: source.displayName,
    body: source.bio,
    tags: [],
    summary: { id: source.accountId, name: source.displayName, username: source.username, avatarUrl: source.avatarUrl, verified: source.verified, isCreator: source.isCreator, verification: source.verification, followers: source.followerCount },
    visibility: "public",
    available: active,
    popularity: source.followerCount,
    region: null,
    version,
    createdAt: source.createdAt,
  };
}

export function buildStoreDocument(source: StoreSource, version: number): SearchDocument {
  return {
    kind: "store",
    entityId: source.storeId,
    ownerAccountId: source.ownerAccountId,
    title: source.name,
    subtitle: source.handle,
    body: [source.description, ...source.categoryNames].join(" "),
    tags: source.categoryNames.map(normalizeSearchText),
    summary: { id: source.storeId, name: source.name, logoUrl: source.logoUrl, rating: source.rating, ratingCount: source.ratingCount, reviewCount: source.reviewCount, verification: source.verification },
    visibility: "public",
    available: source.active,
    popularity: source.ratingCount,
    region: source.countryCode,
    version,
    createdAt: source.createdAt,
  };
}

export function buildBrandDocument(source: BrandSource, version: number): SearchDocument {
  return {
    kind: "brand",
    entityId: source.brandId,
    ownerAccountId: source.ownerAccountId,
    title: source.name,
    subtitle: source.handle,
    body: source.description,
    tags: [],
    summary: { id: source.brandId, name: source.name, handle: source.handle, logoUrl: source.logoUrl, verification: source.verification, followers: source.followerCount, officialStoreId: source.officialStoreId },
    visibility: "public",
    available: source.active,
    popularity: source.followerCount,
    region: null,
    version,
    createdAt: source.createdAt,
  };
}

export function isProductListable(source: ProductSource): boolean {
  return publishedStatuses.has(source.status) && publicVisibilities.has(source.visibility) && source.storeActive && source.stock > 0;
}

export function buildProductDocument(source: ProductSource, version: number): SearchDocument {
  return {
    kind: "product",
    entityId: source.productId,
    ownerAccountId: source.ownerAccountId,
    title: source.name,
    subtitle: source.brandName,
    body: [source.description, ...source.categoryPath].join(" "),
    tags: source.tags.map(normalizeSearchText),
    summary: { id: source.productId, name: source.name, price: { amountMinor: source.priceAmountMinor, currency: source.currency }, imageUrl: source.imageUrl, stock: source.stock, storeId: source.storeId },
    visibility: "public",
    available: isProductListable(source),
    popularity: source.purchaseCount,
    region: source.countryCode,
    version,
    createdAt: source.createdAt,
  };
}
