import type { NotificationPreference } from "@/types/notificationPreference.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const preferences: NotificationPreference[] = [
  { category: "social", push: true, email: true, locked: false },
  { category: "milestones", push: true, email: true, locked: false },
  { category: "marketing", push: false, email: true, locked: false },
];

export const notificationPreferencesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/notifications/preferences", () => ({ data: preferences, nextCursor: null })),
  createMockRoute("PATCH", "/api/v1/notifications/preferences", ({ body }) => {
    const { category, push, email } = body as { category: string; push?: boolean; email?: boolean };
    const index = preferences.findIndex((row) => row.category === category);
    const current = preferences[index];
    if (!current || current.locked) return current ?? { category, push: true, email: true, locked: false };
    const next = { ...current, ...(push === undefined ? {} : { push }), ...(email === undefined ? {} : { email }) };
    preferences[index] = next;
    return next;
  }),
];
