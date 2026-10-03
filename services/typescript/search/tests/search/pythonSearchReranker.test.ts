import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createPythonSearchReranker } from "../../src/integrations/pythonSearchReranker.integration.js";
import type { RerankCandidate } from "../../src/interfaces/searchReranker.interface.js";

const candidates: RerankCandidate[] = ["a", "b"].map((id) => ({ itemId: `product:${id}`, itemType: "product", textRelevanceScore: 1, authorId: null, popularityCount: 1, createdAt: "2026-01-01T00:00:00.000Z" }));

describe("python search reranker", () => {
  it("signs the exact body and returns the item order", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const reranker = createPythonSearchReranker({
      baseUrl: "http://intelligence:8090", sharedSecret: "secret", timeoutMs: 100,
      fetchImplementation: (async (url: URL, init: RequestInit) => {
        captured = { url: url.toString(), init };
        return new Response(JSON.stringify({ items: [{ itemId: "product:b" }, { itemId: "product:a" }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await reranker.rerank("viewer", candidates, 2)).toEqual(["product:b", "product:a"]);
    const headers = captured?.init.headers as Record<string, string>;
    const body = captured?.init.body as string;
    const canonical = ["v1", "POST", "/v1/search/rerank", headers["x-zudo-timestamp"], headers["x-zudo-nonce"], createHash("sha256").update(body).digest("hex")].join("\n");
    expect(headers["x-zudo-signature"]).toBe(`v1=${createHmac("sha256", "secret").update(canonical).digest("hex")}`);
    expect(JSON.parse(body)).not.toHaveProperty("query");
    expect(captured?.url).toBe("http://intelligence:8090/v1/search/rerank");
  });

  it("returns null on errors and opens the circuit after repeated failures", async () => {
    let calls = 0;
    const reranker = createPythonSearchReranker({ baseUrl: "http://x", sharedSecret: "s", timeoutMs: 10, fetchImplementation: (async () => { calls += 1; throw new Error("down"); }) as unknown as typeof fetch });
    for (let attempt = 0; attempt < 8; attempt += 1) expect(await reranker.rerank("viewer", candidates, 2)).toBeNull();
    expect(calls).toBe(5);
  });

  it("skips the call for fewer than two candidates", async () => {
    let calls = 0;
    const reranker = createPythonSearchReranker({ baseUrl: "http://x", sharedSecret: "s", timeoutMs: 10, fetchImplementation: (async () => { calls += 1; return new Response("{}"); }) as unknown as typeof fetch });
    expect(await reranker.rerank("viewer", candidates.slice(0, 1), 1)).toBeNull();
    expect(calls).toBe(0);
  });
});
