import type { SocialProofSelection, SocialProofSelector } from "../interfaces/socialProof.interface.js";
import type { IdentifierHasher } from "../utils/identifierHashing.util.js";
import { createCircuitBreaker, signIntelligenceRequest } from "../utils/intelligenceRequestSigning.util.js";

const selectPath = "/v1/social-proof/select";

interface SelectionPayload {
  readonly itemId?: unknown;
  readonly banner?: { readonly friendIds?: readonly unknown[]; readonly totalFriendCount?: unknown } | null;
}

export function createIntelligenceSocialProofSelector(options: { readonly baseUrl: string; readonly sharedSecret: string; readonly hasher: IdentifierHasher; readonly timeoutMs?: number; readonly fetchImplementation?: typeof fetch }): SocialProofSelector {
  const send = options.fetchImplementation ?? fetch;
  const breaker = createCircuitBreaker();
  return {
    async select(viewerId, followedAccountIds, items) {
      if (breaker.isOpen() || items.length === 0) return null;
      const friendByHash = new Map(items.flatMap((item) => item.likedByFriendIds).map((friendId) => [options.hasher.hashUserId(friendId), friendId]));
      const body = JSON.stringify({
        viewer: { userId: options.hasher.hashUserId(viewerId), followedAccountIds: followedAccountIds.slice(0, 5000).map((accountId) => options.hasher.hashUserId(accountId)) },
        orderedItems: items.slice(0, 500).map((item) => ({
          itemId: item.postId, authorId: options.hasher.hashUserId(item.authorId), storeId: null,
          friendEngagements: item.likedByFriendIds.slice(0, 50).map((friendId) => ({ friendId: options.hasher.hashUserId(friendId), action: "liked" })),
        })),
        options: {},
      });
      try {
        const response = await send(new URL(selectPath, options.baseUrl), { method: "POST", body, headers: signIntelligenceRequest(options.sharedSecret, "POST", selectPath, body), signal: AbortSignal.timeout(options.timeoutMs ?? 80) });
        if (!response.ok) throw new Error(`social proof responded ${response.status}`);
        breaker.recordSuccess();
        const payload = (await response.json()) as { readonly selections?: readonly SelectionPayload[] };
        return (payload.selections ?? []).flatMap((selection): SocialProofSelection[] => {
          if (typeof selection.itemId !== "string" || selection.banner === null || selection.banner === undefined) return [];
          const friendIds = (selection.banner.friendIds ?? []).flatMap((hashed) => (typeof hashed === "string" && friendByHash.has(hashed) ? [friendByHash.get(hashed) as string] : []));
          const total = typeof selection.banner.totalFriendCount === "number" ? selection.banner.totalFriendCount : friendIds.length;
          return friendIds.length === 0 ? [] : [{ postId: selection.itemId, friendIds, totalFriendCount: total }];
        });
      } catch {
        breaker.recordFailure();
        return null;
      }
    },
  };
}
