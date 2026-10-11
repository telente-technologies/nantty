import { describe, expect, it } from "vitest";

import { withHostCircuitBreaker } from "../../src/integrations/hostCircuitBreaker.integration.js";
import type { SafeFetchOptions } from "../../src/integrations/safeHttpFetcher.integration.js";
import { collectPlaceholderSecretProblems } from "../../src/configs/productionSecrets.config.js";

const options = {} as SafeFetchOptions;

describe("host circuit breaker", () => {
  it("stops calling a host after repeated failures and recovers after the open window", async () => {
    let now = 0;
    let calls = 0;
    let healthy = false;
    const fetcher = withHostCircuitBreaker(async (url) => {
      calls += 1;
      if (!healthy) throw new Error("connect timeout");
      return { finalUrl: new URL(url), status: 200, contentType: "text/html", body: Buffer.from("ok") };
    }, { failuresToOpen: 3, openMilliseconds: 1_000, now: () => now });
    for (let attempt = 0; attempt < 3; attempt += 1) await expect(fetcher("https://down.example/a", options)).rejects.toThrow("connect timeout");
    await expect(fetcher("https://down.example/b", options)).rejects.toThrow(/temporarily unavailable/);
    expect(calls).toBe(3);
    await expect(fetcher("https://up.example/a", options)).rejects.toThrow("connect timeout");
    now = 1_001;
    healthy = true;
    expect((await fetcher("https://down.example/c", options)).status).toBe(200);
    expect(calls).toBe(5);
  });
});

describe("production placeholder secrets", () => {
  it("refuses local-only values in production only", () => {
    expect(collectPlaceholderSecretProblems({ NODE_ENV: "production", SOCIAL_INTERNAL_TOKEN: "local-only-social-internal-token-0123456789", DATABASE_URL: "postgres://svc_social:svc_social_local_only@db/zudomart", PORT: "8105" })).toHaveLength(2);
    expect(collectPlaceholderSecretProblems({ NODE_ENV: "production", SOCIAL_INTERNAL_TOKEN: "a".repeat(40) })).toEqual([]);
    expect(collectPlaceholderSecretProblems({ SOCIAL_INTERNAL_TOKEN: "local-only-social-internal-token-0123456789" })).toEqual([]);
  });
});
