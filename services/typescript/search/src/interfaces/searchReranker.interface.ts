export type RerankItemType = "post" | "clip" | "product" | "store" | "account" | "hashtag";

export interface RerankCandidate {
  readonly itemId: string;
  readonly itemType: RerankItemType;
  readonly textRelevanceScore: number;
  readonly authorId: string | null;
  readonly popularityCount: number;
  readonly createdAt: string;
}

export interface SearchReranker {
  rerank(viewerId: string, candidates: readonly RerankCandidate[], limit: number): Promise<readonly string[] | null>;
}

export const noReranker: SearchReranker = { rerank: async () => null };
