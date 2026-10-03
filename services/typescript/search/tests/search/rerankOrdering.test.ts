import { describe, expect, it } from "vitest";

import { applyRerankOrder, buildRerankCandidates } from "../../src/modules/search/services/rerankOrdering.service.js";
import type { SearchHit } from "../../src/types/searchResult.type.js";

const hit = (kind: SearchHit["kind"], entityId: string): SearchHit => ({ kind, entityId, score: 1, summary: {}, popularity: 2.4, createdAt: "2026-01-01T00:00:00.000Z", ownerAccountId: "owner" });

describe("rerank ordering", () => {
  it("keeps unsupported kinds in their slots and reorders the rest", () => {
    const hits = [hit("product", "a"), hit("brand", "b"), hit("product", "c")];
    expect(applyRerankOrder(hits, ["product:c", "product:a"]).map((item) => item.entityId)).toEqual(["c", "b", "a"]);
  });

  it("appends hits the reranker did not return and ignores unknown ids", () => {
    const hits = [hit("product", "a"), hit("product", "b"), hit("product", "c")];
    expect(applyRerankOrder(hits, ["product:b", "product:zzz"]).map((item) => item.entityId)).toEqual(["b", "a", "c"]);
  });

  it("builds candidates only for supported kinds with opaque ids", () => {
    const candidates = buildRerankCandidates([hit("user", "u1"), hit("brand", "b1"), hit("product", "bad id!")]);
    expect(candidates).toEqual([expect.objectContaining({ itemId: "user:u1", itemType: "account", popularityCount: 2 })]);
  });
});
