import { accountHealthMocks } from "./accountHealth.mock";
import { affiliatesMocks } from "./affiliates.mock";
import { authMocks } from "./auth.mock";
import { consentsMocks } from "./consents.mock";
import { contentMocks } from "./content.mock";
import { creatorMocks } from "./creator.mock";
import { liveMocks } from "./lives.mock";
import { liveSafetyMocks } from "./liveSafety.mock";
import { payoutOnboardingMocks } from "./payoutOnboarding.mock";
import { preferencesMocks } from "./preferences.mock";
import { providerWalletMocks } from "./providerWallet.mock";
import type { MockRoute } from "./registry.mock";
import { studioLiveMocks } from "./studioLive.mock";
import { studioSocialMocks } from "./studioSocial.mock";
import { subscriptionsMocks } from "./subscriptions.mock";
import { walletMocks } from "./wallet.mock";

export const routes: MockRoute[] = [...authMocks, ...consentsMocks, ...preferencesMocks, ...liveSafetyMocks, ...liveMocks, ...studioLiveMocks, ...studioSocialMocks, ...payoutOnboardingMocks, ...accountHealthMocks, ...walletMocks, ...providerWalletMocks, ...creatorMocks, ...affiliatesMocks, ...contentMocks, ...subscriptionsMocks];
