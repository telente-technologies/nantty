import { createHash, createHmac, randomBytes } from "node:crypto";

import type { RerankCandidate, SearchReranker } from "../interfaces/searchReranker.interface.js";
import type { IdentifierHasher } from "../utils/identifierHashing.util.js";

export interface PythonRerankerOptions {
  readonly baseUrl: string;
  readonly sharedSecret: string;
  readonly timeoutMs: number;
  readonly hasher: IdentifierHasher;
  readonly fetchImplementation?: typeof fetch;
}

const rerankPath = "/v1/search/rerank";
const failureThreshold = 5;
const circuitOpenMilliseconds = 5000;

function signRequest(secret: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(18).toString("base64url");
  const canonical = ["v1", "POST", rerankPath, timestamp, nonce, createHash("sha256").update(body, "utf8").digest("hex")].join("\n");
  return { "content-type": "application/json", "x-nantty-timestamp": timestamp, "x-nantty-nonce": nonce, "x-nantty-signature": `v1=${createHmac("sha256", secret).update(canonical, "utf8").digest("hex")}` };
}

export function createPythonSearchReranker(options: PythonRerankerOptions): SearchReranker {
  const send = options.fetchImplementation ?? fetch;
  let consecutiveFailures = 0;
  let openUntil = 0;
  return {
    async rerank(viewerId: string, candidates: readonly RerankCandidate[], limit: number) {
      if (candidates.length < 2 || Date.now() < openUntil) return null;
      const body = JSON.stringify({
        viewer: { userId: options.hasher.hashUserId(viewerId) },
        limit: Math.min(Math.max(limit, 1), 200),
        candidates: candidates.map((candidate) => ({ itemId: candidate.itemId, itemType: candidate.itemType, textRelevanceScore: candidate.textRelevanceScore, ...(candidate.authorId === null ? {} : { authorId: options.hasher.hashUserId(candidate.authorId) }), popularityCount: candidate.popularityCount, createdAt: candidate.createdAt })),
        textRelevanceWeight: 0.7,
        personalizationWeight: 0.2,
        popularityWeight: 0.1,
      });
      try {
        const response = await send(new URL(rerankPath, options.baseUrl), { method: "POST", body, headers: signRequest(options.sharedSecret, body), signal: AbortSignal.timeout(options.timeoutMs) });
        if (!response.ok) throw new Error(`rerank responded ${response.status}`);
        const payload = (await response.json()) as { items?: readonly { itemId?: unknown }[] };
        consecutiveFailures = 0;
        const ids = (payload.items ?? []).map((item) => item.itemId).filter((id): id is string => typeof id === "string");
        return ids.length === 0 ? null : ids;
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= failureThreshold) openUntil = Date.now() + circuitOpenMilliseconds;
        return null;
      }
    },
  };
}
