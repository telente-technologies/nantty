import { getSignedInMockUser } from "./fixtures.mock";

export type MockBluePremiumState = "premium" | "standard" | "lapsed";

const PREMIUM_BUSINESS_PROFILE_LIMIT = 5;
const STANDARD_BUSINESS_PROFILE_LIMIT = 2;

const stateOverrideByUserId = new Map<string, MockBluePremiumState>();

export function mockBluePremiumState(): MockBluePremiumState {
  const user = getSignedInMockUser();
  return stateOverrideByUserId.get(user.id) ?? (user.verification?.tier === "PREMIUM" ? "premium" : "standard");
}

export function setMockBluePremiumState(state: MockBluePremiumState | null): void {
  const userId = getSignedInMockUser().id;
  if (state) stateOverrideByUserId.set(userId, state);
  else stateOverrideByUserId.delete(userId);
}

export const mockHasBluePremium = () => mockBluePremiumState() === "premium";

export const mockBusinessProfileLimit = () => (mockHasBluePremium() ? PREMIUM_BUSINESS_PROFILE_LIMIT : STANDARD_BUSINESS_PROFILE_LIMIT);

export const MOCK_PREMIUM_BUSINESS_PROFILE_LIMIT = PREMIUM_BUSINESS_PROFILE_LIMIT;
