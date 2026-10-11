import { SocialError } from "../errors/social.error.js";
import type { StoreInboxTeam } from "../interfaces/storeInboxTeam.interface.js";

const cacheLifetimeMs = 10_000;

export function createHttpStoreInboxTeam(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 2000, now: () => number = Date.now): StoreInboxTeam {
  const cache = new Map<string, { readonly at: number; readonly accountIds: readonly string[] }>();
  return {
    async memberAccountIds(storeId) {
      const cached = cache.get(storeId);
      if (cached !== undefined && now() - cached.at < cacheLifetimeMs) return cached.accountIds;
      const url = new URL(`/api/v1/internal/stores/${encodeURIComponent(storeId)}/inbox-team`, source.baseUrl);
      const response = await fetch(url, { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
      if (response === null || !response.ok) throw new SocialError(503, "STORE_TEAM_UNAVAILABLE", "Secure store chat is temporarily unavailable. Try again shortly.");
      const accountIds = ((await response.json()) as { readonly accountIds?: readonly string[] }).accountIds ?? [];
      cache.set(storeId, { at: now(), accountIds });
      return accountIds;
    },
    forget(storeId) {
      cache.delete(storeId);
    },
  };
}
