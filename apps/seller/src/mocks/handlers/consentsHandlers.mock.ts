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
    const { theme, countryCode } = readJsonObjectBody(request);
    if (theme === undefined && typeof countryCode === "string") {
      if (!/^[A-Z]{2}$/.test(countryCode)) return respondWithValidationFailure([{ path: "countryCode", message: "countryCode must be a two-letter country code." }]);
      return respondWithJson(200, { countryCode, updatedAt: new Date().toISOString() });
    }
    if (theme !== "light" && theme !== "dark" && theme !== "system") return respondWithValidationFailure([{ path: "theme", message: "theme must be light, dark or system." }]);
    return respondWithJson(200, { theme, updatedAt: new Date().toISOString() });
  });
}
