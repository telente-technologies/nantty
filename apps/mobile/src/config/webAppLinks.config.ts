declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly EXPO_PUBLIC_WEBAPP_URL?: string;
    }
  }
}

const PRODUCTION_WEBAPP_URL = "https://web.nantty.com";
const uuidAtEndPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const webAppBaseUrl = (process.env.EXPO_PUBLIC_WEBAPP_URL || PRODUCTION_WEBAPP_URL).replace(/\/+$/, "");

export const deepLinkPrefixes: readonly string[] = [
  "zudomart://",
  "com.zudomart.app://",
  webAppBaseUrl,
  PRODUCTION_WEBAPP_URL,
  "https://nantty.com",
  "https://www.nantty.com",
];

export function slugifyForUrl(text: string): string {
  const slug = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
  return slug === "" ? "item" : slug;
}

export function readProductIdFromSlug(slugAndId: string): string {
  const decoded = decodeURIComponent(slugAndId);
  const uuid = decoded.match(uuidAtEndPattern)?.[1];
  return uuid ?? decoded.slice(decoded.lastIndexOf("-") + 1);
}

export const webAppLinks = {
  profile: (username: string) => `${webAppBaseUrl}/${encodeURIComponent(username.replace(/^@/, ""))}`,
  product: (product: { readonly id: string; readonly name?: string | null }) => `${webAppBaseUrl}/p/${slugifyForUrl(product.name ?? "product")}-${encodeURIComponent(product.id)}`,
  affiliateProduct: (product: { readonly id: string; readonly name?: string | null }, linkId: string) =>
    `${webAppBaseUrl}/p/${slugifyForUrl(product.name ?? "product")}-${encodeURIComponent(product.id)}?aff=${encodeURIComponent(linkId)}`,
  store: (storeId: string) => `${webAppBaseUrl}/store/${encodeURIComponent(storeId)}`,
  post: (postId: string) => `${webAppBaseUrl}/post/${encodeURIComponent(postId)}`,
  clip: (clipId: string) => `${webAppBaseUrl}/post/${encodeURIComponent(clipId)}`,
  live: (liveId: string) => `${webAppBaseUrl}/live/${encodeURIComponent(liveId)}`,
  space: (spaceId: string) => `${webAppBaseUrl}/spaces/${encodeURIComponent(spaceId)}`,
  subscriptionOffer: (token: string) => `${webAppBaseUrl}/offer/${encodeURIComponent(token)}`,
  goldForBusinessesCheckout: (input: { readonly profileIds: readonly string[]; readonly interval: "month" | "year"; readonly expectedTotalMinor: number }) =>
    `${webAppBaseUrl}/verification?goldProfiles=${encodeURIComponent(input.profileIds.join(","))}&goldInterval=${input.interval}`,
};
