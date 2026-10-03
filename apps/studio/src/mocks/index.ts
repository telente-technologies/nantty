import { authMocks } from "./auth.mock";
import { consentsMocks } from "./consents.mock";
import { liveMocks } from "./lives.mock";
import type { MockRoute } from "./registry.mock";

export const routes: MockRoute[] = [...authMocks, ...consentsMocks, ...liveMocks];
