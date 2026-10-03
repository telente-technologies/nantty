import { MockHttpError, readJsonObjectBody, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerConsentsMockHandlers(): void {
  registerMockRoute("POST", "/seller/consents", (request) => {
    if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const { policyVersion, decidedAt, categories } = readJsonObjectBody(request);
    if (typeof policyVersion !== "string" || typeof decidedAt !== "string" || typeof categories !== "object" || categories === null) {
      return respondWithValidationFailure([{ path: "categories", message: "policyVersion, decidedAt and categories are required." }]);
    }
    return respondWithJson(200, { policyVersion, decidedAt, categories, recordedAt: new Date().toISOString() });
  });
}
