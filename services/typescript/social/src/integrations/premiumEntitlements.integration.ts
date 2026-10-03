import type { PremiumEntitlements } from "../interfaces/premiumEntitlements.interface.js";

export const noPremiumEntitlements: PremiumEntitlements = {
  isPremium: async () => false,
  hasSubscribedToCreator: async () => false,
};

const cacheMilliseconds = 60_000;

interface EntitlementResponse {
  readonly premium?: boolean;
  readonly subscribedToCreator?: boolean;
}

export function createHttpPremiumEntitlements(source: { readonly baseUrl: string; readonly internalToken: string }, now: () => number = Date.now, timeoutMs = 2000): PremiumEntitlements {
  const cache = new Map<string, { readonly value: boolean; readonly expiresAt: number }>();
  async function lookup(accountId: string, creatorId: string | undefined): Promise<EntitlementResponse> {
    const url = new URL(`/api/v1/internal/entitlements/${encodeURIComponent(accountId)}`, source.baseUrl);
    if (creatorId !== undefined) url.searchParams.set("creatorId", creatorId);
    const response = await fetch(url, { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`entitlements responded ${response.status}`);
    return (await response.json()) as EntitlementResponse;
  }
  async function cached(key: string, load: () => Promise<boolean>): Promise<boolean> {
    const hit = cache.get(key);
    if (hit !== undefined && hit.expiresAt > now()) return hit.value;
    try {
      const value = await load();
      cache.set(key, { value, expiresAt: now() + cacheMilliseconds });
      return value;
    } catch {
      return false;
    }
  }
  return {
    isPremium: (accountId) => cached(`premium:${accountId}`, async () => (await lookup(accountId, undefined)).premium === true),
    hasSubscribedToCreator: (viewerId, creatorId) => cached(`creator:${viewerId}:${creatorId}`, async () => (await lookup(viewerId, creatorId)).subscribedToCreator === true),
  };
}
