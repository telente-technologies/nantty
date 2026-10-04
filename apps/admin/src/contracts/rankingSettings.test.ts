import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateFeedRankingPolicy, validateTrendRemovals } from "@/mocks/handlers/configuration/rankingSettingsValidation.mock";

const policy = (overrides: Record<string, unknown> = {}) => ({ tierBoostBps: { blue_essential: 10_200, blue_verified: 10_400, premium: 10_600, gold_business: 10_800, black_official: 11_000 }, officialEditorialBoostBps: 11_000, ...overrides });

describe("feed ranking settings", () => {
  it("accepts boosts within the hard caps", () => {
    assert.equal(validateFeedRankingPolicy(policy()).tierBoostBps.black_official, 11_000);
  });

  it("rejects boosts above the caps, broken tier order and push levers", () => {
    assert.throws(() => validateFeedRankingPolicy(policy({ officialEditorialBoostBps: 20_000 })));
    assert.throws(() => validateFeedRankingPolicy(policy({ tierBoostBps: { blue_essential: 10_200, blue_verified: 10_400, premium: 11_000, gold_business: 10_800, black_official: 11_000 } })));
    assert.throws(() => validateFeedRankingPolicy(policy({ pushPostIds: ["post_1"] })));
  });
});

describe("trend moderation", () => {
  const removal = { kind: "hashtag", key: "buyfollowers", country: "NG", reason: "manipulation", note: "", removedAt: "2026-10-04T10:00:00Z" };

  it("accepts a removal with a policy reason", () => {
    assert.equal(validateTrendRemovals({ removals: [removal] }).length, 1);
  });

  it("rejects missing reasons, duplicates and pins", () => {
    assert.throws(() => validateTrendRemovals({ removals: [{ ...removal, reason: "promote" }] }));
    assert.throws(() => validateTrendRemovals({ removals: [removal, removal] }));
    assert.throws(() => validateTrendRemovals({ removals: [{ ...removal, kind: "pin" }] }));
  });
});
