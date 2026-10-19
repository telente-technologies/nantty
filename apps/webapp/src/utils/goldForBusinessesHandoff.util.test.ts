import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GoldForBusinessesState } from "@/types/goldForBusinesses.type";

import { readGoldForBusinessesHandoff } from "./goldForBusinessesHandoff.util";

const business = (profileId: string, hasOwnGold = false) => ({ profileId, displayName: profileId, profileType: "business", coverage: "none", hasOwnGold }) as GoldForBusinessesState["businesses"][number];
const state = (premium: boolean): GoldForBusinessesState => ({
  premium,
  rules: { maximumProfiles: 2, yearlyExtraBps: 500, yearlyMode: "replace", tiers: [] },
  businesses: [business("p1"), business("p2"), business("p3"), business("owned", true)],
  subscription: null,
});

describe("gold for businesses hand-off from the app", () => {
  it("preselects only eligible businesses, capped at the plan maximum, with the chosen interval", () => {
    assert.deepEqual(readGoldForBusinessesHandoff("?goldProfiles=owned,p1,unknown,p1,p2,p3&goldInterval=year", state(true)), { profileIds: ["p1", "p2"], interval: "year" });
  });

  it("falls back to monthly with nothing ticked for odd input or without Premium", () => {
    assert.deepEqual(readGoldForBusinessesHandoff("?goldInterval=weekly", state(true)), { profileIds: [], interval: "month" });
    assert.deepEqual(readGoldForBusinessesHandoff("?goldProfiles=p1&goldInterval=year", state(false)), { profileIds: [], interval: "year" });
  });
});
