import { isThemePreference } from "@nantty/web-kit/src/theme/themePreference.constant";

import { requireMockPrincipal } from "@/mocks/mockGuards.mock";
import { failValidation, readIsoNow, readJsonObjectBody, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export function registerUserPreferencesMockHandlers(): void {
  registerMockRoute("PATCH", "/admin/users/me/preferences", (request) => {
    requireMockPrincipal(request);
    const { theme } = readJsonObjectBody(request);
    if (!isThemePreference(theme)) failValidation("theme", "theme must be light, dark or system.");
    return respondWithJson(200, { theme, updatedAt: readIsoNow() });
  });
}
