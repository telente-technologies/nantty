import { failValidation, readJsonObjectBody, requirePrincipal, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

const themePreferenceByUserId = new Map<string, string>();

export function registerUserPreferencesMockHandlers(): void {
  registerMockRoute("PATCH", "/users/me/preferences", (request) => {
    const { userId } = requirePrincipal(request);
    const { theme } = readJsonObjectBody(request);
    if (theme !== "light" && theme !== "dark" && theme !== "system") failValidation("theme", "theme must be light, dark or system.");
    themePreferenceByUserId.set(userId, theme as string);
    return respondWithNoContent();
  });
}
