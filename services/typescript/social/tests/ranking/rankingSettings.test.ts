import { describe, expect, it, vi } from "vitest";

import { createAdminRankingSettingsSource, defaultRankingSettings, parseFeedRankingSetting, parseTrendingModerationSetting } from "../../src/integrations/adminRankingSettings.integration.js";

describe("admin ranking settings", () => {
  it("converts basis points and re-applies the hard caps server-side", () => {
    const policy = parseFeedRankingSetting({ version: 4, value: { tierBoostBps: { blue_essential: 10100, blue_verified: 10300, premium: 10500, gold_business: 10700, black_official: 99999 }, officialEditorialBoostBps: 50000 } });
    expect(policy.version).toBe(4);
    expect(policy.tierBoosts.blue_essential).toBeCloseTo(1.01);
    expect(policy.tierBoosts.black_official).toBe(1.15);
    expect(policy.officialEditorialBoost).toBe(1.15);
  });

  it("reads trend removals and ignores anything that is not a removal", () => {
    expect(parseTrendingModerationSetting({ value: { removals: [{ kind: "hashtag", key: "buyfollowers", country: "NG", reason: "manipulation" }, { kind: "promote", key: "x" }] } })).toEqual([{ kind: "hashtag", key: "buyfollowers", country: "NG", reason: "manipulation" }]);
  });

  it("caches settings and falls back to defaults when the admin service is down", async () => {
    let time = 0;
    const fetchImplementation = vi.fn(async () => new Response("down", { status: 503 }));
    const source = createAdminRankingSettingsSource({ baseUrl: "http://admin", internalToken: "t", fetchImplementation, now: () => time });
    expect(await source.read()).toEqual(defaultRankingSettings);
    time += 1000;
    await source.read();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
