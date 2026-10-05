import { cookies } from "next/headers";
import { cache } from "react";

import type { BrandedProduct } from "@/types/brand.type";
import type { StoreDetail } from "@/types/commerce.type";
import type { ProductSummary, User } from "@/types";

import { callWebappBackend, readJsonFromBackendResult } from "./apiTransport.service";
import { readApiTokensFromCookies } from "./session.service";

export type SitemapKind = "products" | "stores" | "profiles";

export interface SitemapEntry {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string | null;
}

export interface SitemapPage {
  readonly entries: readonly SitemapEntry[];
  readonly totalPages: number;
}

async function fetchPublicJson<Payload>(path: string, query?: Record<string, string>, accessToken?: string | null): Promise<Payload | null> {
  const result = await callWebappBackend({ method: "GET", path, query: new URLSearchParams(query ?? {}), accessToken, forwardedHeaders: { "x-client-region": "NG" } });
  if (result.status !== 200) return null;
  return readJsonFromBackendResult<Payload>(result);
}

const safeIdPattern = /^[A-Za-z0-9_.~-]{1,100}$/;
const usernamePattern = /^[A-Za-z0-9._]{1,30}$/;

export const fetchPublicProduct = cache(async (productId: string): Promise<BrandedProduct | null> =>
  safeIdPattern.test(productId) ? fetchPublicJson<BrandedProduct>(`/api/v1/products/${encodeURIComponent(productId)}`) : null);

export const fetchPublicStore = cache(async (storeId: string): Promise<StoreDetail | null> =>
  safeIdPattern.test(storeId) ? fetchPublicJson<StoreDetail>(`/api/v1/stores/${encodeURIComponent(storeId)}`) : null);

export const fetchPublicStoreProducts = cache(async (storeId: string): Promise<readonly ProductSummary[]> => {
  const payload = safeIdPattern.test(storeId) ? await fetchPublicJson<ProductSummary[] | { readonly data?: readonly ProductSummary[] }>(`/api/v1/stores/${encodeURIComponent(storeId)}/products`) : null;
  return Array.isArray(payload) ? payload : (payload?.data ?? []);
});

export const fetchPublicProfileById = cache(async (userId: string): Promise<User | null> => {
  if (!safeIdPattern.test(userId) || userId === "me") return null;
  const { accessToken } = readApiTokensFromCookies(await cookies());
  return fetchPublicJson<User>(`/api/v1/users/${encodeURIComponent(userId)}`, undefined, accessToken);
});

export const fetchPublicProfileByUsername = cache(async (username: string): Promise<User | null> => {
  if (!usernamePattern.test(username)) return null;
  const found = await fetchPublicJson<Partial<User> & { readonly id: string }>(`/api/v1/users/by-username/${encodeURIComponent(username.toLowerCase())}`);
  if (!found) return null;
  return typeof found.username === "string" ? (found as User) : fetchPublicProfileById(found.id);
});

export const fetchSitemapPage = cache(async (kind: SitemapKind, page: number): Promise<SitemapPage> =>
  (await fetchPublicJson<SitemapPage>(`/api/v1/sitemap/${kind}`, { page: String(page) })) ?? { entries: [], totalPages: 0 });
