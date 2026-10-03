import type { RerankCandidate, RerankItemType } from "../../../interfaces/searchReranker.interface.js";
import type { SearchHit } from "../../../types/searchResult.type.js";

const itemTypeByKind: Readonly<Record<string, RerankItemType>> = { user: "account", store: "store", product: "product", post: "post", clip: "clip", hashtag: "hashtag" };
const opaqueIdentifierPattern = /^[A-Za-z0-9_\-:.]{1,128}$/;

export function rerankItemIdentifier(hit: SearchHit): string {
  return `${hit.kind}:${hit.entityId}`;
}

export function buildRerankCandidates(hits: readonly SearchHit[]): RerankCandidate[] {
  return hits.flatMap((hit) => {
    const itemType = itemTypeByKind[hit.kind];
    const itemId = rerankItemIdentifier(hit);
    if (itemType === undefined || !opaqueIdentifierPattern.test(itemId)) return [];
    return [{ itemId, itemType, textRelevanceScore: Math.max(0, Math.min(hit.score, 1_000_000)), authorId: hit.ownerAccountId, popularityCount: Math.max(0, Math.round(hit.popularity)), createdAt: hit.createdAt }];
  });
}

export function applyRerankOrder(hits: readonly SearchHit[], orderedItemIds: readonly string[]): SearchHit[] {
  const byId = new Map(hits.map((hit) => [rerankItemIdentifier(hit), hit]));
  const ranked = orderedItemIds.map((id) => byId.get(id)).filter((hit): hit is SearchHit => hit !== undefined);
  const rankedSet = new Set(ranked);
  const eligibleOrder = [...ranked, ...hits.filter((hit) => itemTypeByKind[hit.kind] !== undefined && !rankedSet.has(hit) && opaqueIdentifierPattern.test(rerankItemIdentifier(hit)))];
  const eligibleSet = new Set(eligibleOrder);
  const queue = [...eligibleOrder];
  return hits.map((hit) => (eligibleSet.has(hit) ? (queue.shift() as SearchHit) : hit));
}
