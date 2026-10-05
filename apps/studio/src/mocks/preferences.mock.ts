import { ApiError } from "@/errors/api.error";
import { isThemePreference, type ThemePreference } from "@zudomart/web-kit";

import { createMockRoute, type MockRoute } from "./registry.mock";

let viewerPreferences: { theme: ThemePreference } = { theme: "system" };

export const preferencesMocks: MockRoute[] = [
  createMockRoute("PATCH", "/api/v1/users/me/preferences", ({ body }) => {
    const { theme } = (body ?? {}) as { theme?: unknown };
    if (!isThemePreference(theme)) throw new ApiError(422, "theme must be light, dark or system");
    viewerPreferences = { ...viewerPreferences, theme };
    return undefined;
  }),
];
