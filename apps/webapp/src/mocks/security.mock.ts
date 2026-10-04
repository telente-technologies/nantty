import { createMockRoute, type MockRoute } from "./registry.mock";

export const securityMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/security/human-verification", () => ({ requirement: "none", reason: null, provider: "turnstile" })),
  createMockRoute("POST", "/api/v1/security/human-verification", () => ({ verified: true, requirement: "none", clearedUntil: new Date(Date.now() + 86_400_000).toISOString() })),
  createMockRoute("POST", "/api/v1/security/client-signals", () => ({ received: true })),
];
