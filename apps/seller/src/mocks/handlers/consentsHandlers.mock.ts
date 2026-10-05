import { MockHttpError, readJsonObjectBody, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerConsentsMockHandlers(): void {
  registerMockRoute("PUT", "/users/me/consents", (request) => {
    if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const { policyVersion, consents } = readJsonObjectBody(request);
    if (typeof policyVersion !== "string" || typeof consents !== "object" || consents === null) {
      return respondWithValidationFailure([{ path: "consents", message: "policyVersion and consents are required." }]);
    }
    return respondWithJson(200, { policyVersion, consents, recordedAt: new Date().toISOString() });
  });

  registerMockRoute("PATCH", "/users/me/preferences", (request) => {
    if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const { theme } = readJsonObjectBody(request);
    if (theme !== "light" && theme !== "dark" && theme !== "system") return respondWithValidationFailure([{ path: "theme", message: "theme must be light, dark or system." }]);
    return respondWithJson(200, { theme, updatedAt: new Date().toISOString() });
  });
}
