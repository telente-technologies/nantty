import { requireMockPrincipal } from "@/mocks/mockGuards.mock";
import { failValidation, readIsoNow, readJsonObjectBody, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerConsentsMockHandlers(): void {
  registerMockRoute("POST", "/admin/consents", (request) => {
    requireMockPrincipal(request);
    const { policyVersion, decidedAt, categories } = readJsonObjectBody(request);
    if (typeof policyVersion !== "string" || typeof decidedAt !== "string" || typeof categories !== "object" || categories === null) failValidation("categories", "policyVersion, decidedAt and categories are required.");
    return respondWithJson(200, { policyVersion, decidedAt, categories, recordedAt: readIsoNow() });
  });
}
