import { describe, expect, it, vi } from "vitest";

import { createHttpPremiumEntitlements } from "../../src/integrations/premiumEntitlements.integration.js";
import { buildLastSevenDays } from "../../src/modules/posts/services/postAnalytics.service.js";
import { canUseSound } from "../../src/modules/sounds/services/soundView.service.js";

describe("http premium entitlements", () => {
  it("caches for 60 seconds and fails closed", async () => {
    let clock = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ premium: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const entitlements = createHttpPremiumEntitlements({ baseUrl: "http://money", internalToken: "t" }, () => clock);
    expect(await entitlements.isPremium("a")).toBe(true);
    clock = 59_000;
    await entitlements.isPremium("a");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock = 61_000;
    await entitlements.isPremium("a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await entitlements.isPremium("b")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("checks paid scheduling for the exact profile without caching and fails closed", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      return new Response(JSON.stringify({ canSchedulePosts: url.searchParams.get("profileId") === "business-profile" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const entitlements = createHttpPremiumEntitlements({ baseUrl: "http://money.internal", internalToken: "internal-token" });

    expect(await entitlements.canSchedulePosts("owner", "business-profile")).toBe(true);
    expect(await entitlements.canSchedulePosts("owner", "other-profile")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/api/v1/internal/entitlements/owner");
    expect(requested.searchParams.get("includeScheduling")).toBe("true");
    expect(requested.searchParams.get("profileId")).toBe("business-profile");

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("money service unavailable"); }));
    expect(await entitlements.canSchedulePosts("owner", "business-profile")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("post analytics days", () => {
  it("returns seven days oldest first with zeros", () => {
    const days = buildLastSevenDays(new Date("2026-10-03T12:00:00Z"), new Map([["2026-10-03", 5]]));
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: "2026-09-27", impressions: 0 });
    expect(days[6]).toEqual({ day: "2026-10-03", impressions: 5 });
  });
});

describe("sound reuse", () => {
  it("lets owners always reuse and others only when allowed", () => {
    expect(canUseSound({ ownerId: "o", allowReuse: false, status: "available" }, "o")).toBe(true);
    expect(canUseSound({ ownerId: "o", allowReuse: false, status: "available" }, "x")).toBe(false);
    expect(canUseSound({ ownerId: "o", allowReuse: true, status: "removed" }, "x")).toBe(false);
  });
});
