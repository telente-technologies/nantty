import { accountHealthMocks } from "./accountHealth.mock";
import { authMocks } from "./auth.mock";
import { consentsMocks } from "./consents.mock";
import { liveMocks } from "./lives.mock";
import { liveSafetyMocks } from "./liveSafety.mock";
import { payoutOnboardingMocks } from "./payoutOnboarding.mock";
import { preferencesMocks } from "./preferences.mock";
import type { MockRoute } from "./registry.mock";

export const routes: MockRoute[] = [...authMocks, ...consentsMocks, ...preferencesMocks, ...liveSafetyMocks, ...liveMocks, ...payoutOnboardingMocks, ...accountHealthMocks];
