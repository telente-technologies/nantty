import type { BrandedProduct } from "@/types/brand.type";
import type { StoreDetail } from "@/types/commerce.type";
import type { User } from "@/types";

import { buildAbsoluteSiteUrl, buildProductPath, buildProfilePath, buildStorePath } from "./seoPaths.util";

type JsonLd = Record<string, unknown>;

const minorUnitDigitsByCurrency: Readonly<Record<string, number>> = { NGN: 2, GHS: 2, KES: 2, ZAR: 2, GBP: 2, EUR: 2, USD: 2 };

export function convertMinorAmountToDecimalString(amountMinor: number, currency: string): string {
  const digits = minorUnitDigitsByCurrency[currency] ?? 2;
  return (amountMinor / 10 ** digits).toFixed(digits);
}

export function serializeJsonLdForScriptTag(data: JsonLd | readonly JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function buildOrganizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zudomart",
    url: buildAbsoluteSiteUrl("/"),
    logo: buildAbsoluteSiteUrl("/zudomartLogo.png"),
  };
}

export function buildBreadcrumbJsonLd(items: readonly { readonly name: string; readonly path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: buildAbsoluteSiteUrl(item.path) })),
  };
}

export function isProductInStock(product: Pick<BrandedProduct, "stock">): boolean {
  return product.stock === undefined || product.stock > 0;
}

export function buildProductJsonLd(product: BrandedProduct): JsonLd {
  const images = (product.images.length > 0 ? product.images : [product.imageUrl]).filter((image): image is string => typeof image === "string" && image !== "");
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${buildAbsoluteSiteUrl(buildProductPath(product))}#product`,
    name: product.name || product.title,
    description: product.description,
    image: images,
    sku: product.id,
    url: buildAbsoluteSiteUrl(buildProductPath(product)),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    offers: {
      "@type": "Offer",
      url: buildAbsoluteSiteUrl(buildProductPath(product)),
      priceCurrency: product.price.currency,
      price: convertMinorAmountToDecimalString(product.price.amountMinor, product.price.currency),
      availability: isProductInStock(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: product.store.name, url: buildAbsoluteSiteUrl(buildStorePath(product.store.id)) },
    },
    ...(product.rating > 0 && product.store.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.toFixed(1), reviewCount: product.store.reviewCount, bestRating: "5", worstRating: "1" } }
      : {}),
  };
}

export function buildStoreJsonLd(store: StoreDetail): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${buildAbsoluteSiteUrl(buildStorePath(store.id))}#store`,
    name: store.name,
    description: store.bio,
    url: buildAbsoluteSiteUrl(buildStorePath(store.id)),
    ...(store.logoUrl ? { logo: store.logoUrl, image: store.logoUrl } : {}),
    ...(store.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: store.rating.toFixed(1), reviewCount: store.ratingCount, bestRating: "5", worstRating: "1" } } : {}),
  };
}

export function buildProfilePageJsonLd(user: User): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: buildAbsoluteSiteUrl(buildProfilePath(user.username)),
    mainEntity: {
      "@type": "Person",
      name: user.name || user.username,
      alternateName: `@${user.username}`,
      identifier: user.id,
      ...(user.bio ? { description: user.bio } : {}),
      ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
      interactionStatistic: [{ "@type": "InteractionCounter", interactionType: "https://schema.org/FollowAction", userInteractionCount: user.followers }],
    },
  };
}
