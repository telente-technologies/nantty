import type { CreatorStatus, NewPostInput, Post, TagCandidate } from "@/types";
import type { SearchItem } from "@/types/search.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";
import { searchService } from "./search.service";

export const composerService = {
  fetchMyCreatorStatus: () => sendRequestToWebappServer<CreatorStatus>("/api/v1/creators/me"),
  publishPost: (input: NewPostInput, idempotencyKey: string = createIdempotencyKey("post")) =>
    sendRequestToWebappServer<Post>("/api/v1/posts", { method: "POST", body: input, idempotencyKey }),
  searchTagCandidates: async (text: string): Promise<readonly TagCandidate[]> =>
    text.trim() ? (await sendRequestToWebappServer<{ readonly candidates: readonly TagCandidate[] }>("/api/v1/tags/candidates", { query: { q: text.trim() } })).candidates : [],
  searchTaggableProducts: async (text: string): Promise<readonly Extract<SearchItem, { readonly type: "product" }>[]> => {
    if (!text.trim()) return [];
    const page = await searchService.searchWithinScope(text.trim(), "mart", "products", null);
    return page.data.filter((item): item is Extract<SearchItem, { readonly type: "product" }> => item.type === "product");
  },
};
