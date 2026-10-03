import { failValidation, readIsoNow, readJsonObjectBody, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerConsentsMockHandlers(): void {
  registerMockRoute("POST", "/ads/consents", (request) => {
    requirePrincipal(request);
    const { policyVersion, decidedAt, categories } = readJsonObjectBody(request);
    if (typeof policyVersion !== "string" || typeof decidedAt !== "string" || typeof categories !== "object" || categories === null) failValidation("categories", "policyVersion, decidedAt and categories are required.");
    return respondWithJson(200, { policyVersion, decidedAt, categories, recordedAt: readIsoNow() });
  });
}
