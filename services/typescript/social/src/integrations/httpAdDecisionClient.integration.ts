import type { AdDecisionClient, DecidedAd } from "../interfaces/adDecisions.interface.js";
import { createCircuitBreaker, signIntelligenceRequest } from "../utils/intelligenceRequestSigning.util.js";

const decidePath = "/internal/v1/ads/decide";

export function createHttpAdDecisionClient(options: { readonly baseUrl: string; readonly sharedSecret: string; readonly timeoutMs?: number; readonly fetchImplementation?: typeof fetch }): AdDecisionClient {
  const send = options.fetchImplementation ?? fetch;
  const breaker = createCircuitBreaker();
  return {
    async decide(request) {
      if (breaker.isOpen()) return null;
      const body = JSON.stringify({
        userId: request.userId,
        sessionId: request.sessionId,
        slot: { kind: request.slotKind, contentId: "", neighbourContentIds: request.neighbourContentIds.slice(0, 10), slotsSinceLastAd: request.slotsSinceLastAd, slotIndex: request.slotIndex },
        viewer: { country: request.viewer.country ?? "", region: "", ageBand: "", gender: "", topics: request.viewer.topics.slice(0, 50), customAudienceIds: [], premiumAdFree: request.viewer.premiumAdFree },
        content: null,
      });
      try {
        const response = await send(new URL(decidePath, options.baseUrl), { method: "POST", body, headers: signIntelligenceRequest(options.sharedSecret, "POST", decidePath, body), signal: AbortSignal.timeout(options.timeoutMs ?? 300) });
        if (!response.ok) throw new Error(`ads decide responded ${response.status}`);
        breaker.recordSuccess();
        return ((await response.json()) as { readonly ad?: DecidedAd | null }).ad ?? null;
      } catch {
        breaker.recordFailure();
        return null;
      }
    },
  };
}
