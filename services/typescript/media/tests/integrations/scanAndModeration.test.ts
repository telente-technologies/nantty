import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseClamAvResponse } from "../../src/integrations/clamAvTcpScanner.integration.js";
import { createHttpModerationClient } from "../../src/integrations/httpModerationClient.integration.js";
import { decideModerationFromScore, evaluateModeration } from "../../src/modules/assets/services/moderationPolicy.service.js";

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

  it("fails closed when no classifier is configured unless policy explicitly allows it", async () => {
    const policy = { baseUrl: undefined, token: "", failMode: "hold" as const, holdThreshold: 0.5, rejectThreshold: 0.97, timeoutMs: 1000 };
    const request = { mediaId: "m1", ownerId: "o1", purpose: "post", kind: "image" as const, frames: [Buffer.from("frame")] };
    expect(await evaluateModeration(undefined, policy, request)).toMatchObject({ decision: "hold", degraded: true });
    expect(await evaluateModeration(undefined, { ...policy, failMode: "allow" }, request)).toMatchObject({ decision: "allow", degraded: true });
  });
});

describe("python moderation client", () => {
  it("posts frames to /v1/moderation/classify signed with the shared secret and clamps the score", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ score: 1.4, topCategory: "violence" }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = createHttpModerationClient({ baseUrl: "http://intelligence.test/", token: "secret", timeoutMs: 1000, fetchFn });
    const result = await client.classify({ mediaId: "m1", ownerId: "o1", purpose: "post", kind: "image", frames: [Buffer.from("frame")] });
    expect(result).toEqual({ score: 1, topCategory: "violence" });
    expect(calls[0]?.url).toBe("http://intelligence.test/v1/moderation/classify");
    const headers = calls[0]?.init.headers as Record<string, string>;
    const canonical = ["v1", "POST", "/v1/moderation/classify", headers["x-nantty-timestamp"], headers["x-nantty-nonce"], createHash("sha256").update(calls[0]?.init.body as string).digest("hex")].join("\n");
    expect(headers["x-nantty-signature"]).toBe(`v1=${createHmac("sha256", "secret").update(canonical).digest("hex")}`);
    expect(headers["x-internal-token"]).toBeUndefined();
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
