import { failValidation, readJsonObjectBody, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerConsentsMockHandlers(): void {
  registerMockRoute("PUT", "/users/me/consents", (request) => {
    requirePrincipal(request);
    const { policyVersion, consents } = readJsonObjectBody(request);
    if (typeof policyVersion !== "string" || typeof consents !== "object" || consents === null) failValidation("consents", "policyVersion and consents are required.");
    return respondWithJson(200, { data: [], nextCursor: null, policyVersion, needsRenewal: false });
  });
}
