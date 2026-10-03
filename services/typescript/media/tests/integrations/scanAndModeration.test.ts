import { describe, expect, it } from "vitest";

import { parseClamAvResponse } from "../../src/integrations/clamAvTcpScanner.integration.js";
import { createHttpModerationClient } from "../../src/integrations/httpModerationClient.integration.js";
import { decideModerationFromScore } from "../../src/modules/assets/services/moderationPolicy.service.js";

describe("clamd responses", () => {
  it("maps OK and FOUND answers", () => {
    expect(parseClamAvResponse("stream: OK\0")).toEqual({ verdict: "clean" });
    expect(parseClamAvResponse("stream: Win.Test.EICAR_HDB-1 FOUND\0")).toEqual({ verdict: "infected", signature: "Win.Test.EICAR_HDB-1" });
    expect(() => parseClamAvResponse("INSTREAM size limit exceeded. ERROR")).toThrow("unexpected clamd response");
  });
});

describe("moderation policy", () => {
  const thresholds = { holdThreshold: 0.5, rejectThreshold: 0.97 };

  it("allows, holds or rejects by score", () => {
    expect(decideModerationFromScore(0.2, thresholds)).toBe("allow");
    expect(decideModerationFromScore(0.5, thresholds)).toBe("hold");
    expect(decideModerationFromScore(0.96, thresholds)).toBe("hold");
    expect(decideModerationFromScore(0.97, thresholds)).toBe("reject");
  });
});

describe("python moderation client", () => {
  it("posts frames to /v1/moderation/classify with the internal token and clamps the score", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ score: 1.4, topCategory: "violence" }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = createHttpModerationClient({ baseUrl: "http://intelligence.test/", token: "secret", timeoutMs: 1000, fetchFn });
    const result = await client.classify({ mediaId: "m1", ownerId: "o1", purpose: "post", kind: "image", frames: [Buffer.from("frame")] });
    expect(result).toEqual({ score: 1, topCategory: "violence" });
    expect(calls[0]?.url).toBe("http://intelligence.test/v1/moderation/classify");
    expect((calls[0]?.init.headers as Record<string, string>)["x-internal-token"]).toBe("secret");
    const sent = JSON.parse(calls[0]?.init.body as string) as { contentId: string; media: { frames: { mimeType: string }[] } };
    expect(sent.contentId).toBe("m1");
    expect(sent.media.frames[0]?.mimeType).toBe("image/jpeg");
  });

  it("throws on non-2xx answers so the policy can degrade", async () => {
    const fetchFn = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const client = createHttpModerationClient({ baseUrl: "http://x", token: "", timeoutMs: 1000, fetchFn });
    await expect(client.classify({ mediaId: "m", ownerId: "o", purpose: "post", kind: "video", frames: [] })).rejects.toThrow("503");
  });
});
