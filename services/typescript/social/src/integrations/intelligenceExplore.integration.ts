import type { IntelligenceExploreClient, IntelligenceHeadline, IntelligenceTrendItem } from "../interfaces/intelligenceExplore.interface.js";
import { createCircuitBreaker, signIntelligenceRequest } from "../utils/intelligenceRequestSigning.util.js";

export interface IntelligenceExploreOptions {
  readonly baseUrl: string;
  readonly sharedSecret: string;
  readonly timeoutMs: number;
  readonly fetchImplementation?: typeof fetch;
}

const topicSlugPattern = /^[a-z0-9_-]{1,64}$/;
const onlySlugs = (values: readonly string[]): string[] => values.filter((value) => topicSlugPattern.test(value));

export function createIntelligenceExploreClient(options: IntelligenceExploreOptions): IntelligenceExploreClient {
  const send = options.fetchImplementation ?? fetch;
  const breaker = createCircuitBreaker();
  const post = async <T>(path: string, payload: unknown): Promise<T | null> => {
    if (breaker.isOpen()) return null;
    const body = JSON.stringify(payload);
    try {
      const response = await send(new URL(path, options.baseUrl), { method: "POST", body, headers: signIntelligenceRequest(options.sharedSecret, "POST", path, body), signal: AbortSignal.timeout(options.timeoutMs) });
      if (!response.ok) throw new Error(`${path} responded ${response.status}`);
      breaker.recordSuccess();
      return (await response.json()) as T;
    } catch {
      breaker.recordFailure();
      return null;
    }
  };
  return {
    async readTrendingHashtags(input) {
      const payload = await post<{ items?: readonly IntelligenceTrendItem[] }>("/v1/trending", {
        kind: "hashtag",
        ...(input.country ? { country: input.country } : {}),
        ...(input.category && input.category !== "other" ? { category: input.category } : {}),
        limit: input.limit,
        excludedIds: onlySlugs(input.excludedIds).slice(0, 1000),
      });
      return payload?.items ?? null;
    },
    async buildHeadlines(input) {
      const payload = await post<{ headlines?: readonly IntelligenceHeadline[] }>("/v1/trending/headlines", {
        ...(input.country ? { country: input.country } : {}),
        ...(input.category && input.category !== "other" ? { category: input.category } : {}),
        limit: input.limit,
        excludedStoryKeys: onlySlugs(input.excludedStoryKeys).slice(0, 500),
        posts: input.posts.slice(0, 1000).map((sourcePost) => ({ ...sourcePost, hashtags: onlySlugs(sourcePost.hashtags).slice(0, 20), text: sourcePost.text.slice(0, 2000) })),
      });
      return payload?.headlines ?? null;
    },
  };
}
