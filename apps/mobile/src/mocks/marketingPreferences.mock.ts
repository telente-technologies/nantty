import { ApiError } from "@/errors/api.error";
import type { MarketingFrequency, MarketingPreferences } from "@/types/trust.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const FREQUENCIES: readonly MarketingFrequency[] = ["weekly", "important_only", "off"];

let preferences: MarketingPreferences = { frequency: "weekly" };

export const marketingPreferencesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/marketing-preferences", () => preferences),
  createMockRoute("PUT", "/api/v1/users/me/marketing-preferences", ({ body }) => {
    const { frequency } = body as MarketingPreferences;
    if (!FREQUENCIES.includes(frequency)) throw new ApiError(422, "Choose weekly, only important or off");
    preferences = { frequency };
    return preferences;
  }),
];
