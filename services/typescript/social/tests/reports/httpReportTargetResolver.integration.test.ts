import { describe, expect, it, vi } from "vitest";

import { createHttpReportTargetResolver } from "../../src/integrations/httpReportTargetResolver.integration.js";

const sources = {
  commerce: { baseUrl: "http://commerce.internal", internalToken: "commerce-secret" },
  live: { baseUrl: "http://live.internal", internalToken: "live-secret" },
};

describe("report target resolution", () => {
  it.each([
    ["product", "commerce.internal", "commerce-secret"],
    ["store", "commerce.internal", "commerce-secret"],
    ["space", "live.internal", "live-secret"],
    ["live", "live.internal", "live-secret"],
  ] as const)("resolves %s against its owning service", async (targetType, host, token) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ownerId: "owner-1" }), { status: 200 }));
    const resolver = createHttpReportTargetResolver(sources, fetcher);

    await expect(resolver.resolveOwner(targetType, "target/id")).resolves.toBe("owner-1");
    expect(fetcher).toHaveBeenCalledWith(new URL(`/api/v1/internal/moderation/targets/${targetType}/target%2Fid`, `http://${host}`), expect.objectContaining({ headers: { "x-internal-token": token } }));
  });

  it("treats missing targets as absent and fails closed on service errors", async () => {
    const missing = createHttpReportTargetResolver(sources, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(missing.resolveOwner("space", "space-1")).resolves.toBeNull();

    const unavailable = createHttpReportTargetResolver(sources, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(unavailable.resolveOwner("product", "product-1")).rejects.toThrow("503");
  });

  it("refuses to resolve without an owner-service credential", async () => {
    const resolver = createHttpReportTargetResolver({ commerce: sources.commerce });
    await expect(resolver.resolveOwner("space", "space-1")).rejects.toThrow("source unavailable");
  });
});
