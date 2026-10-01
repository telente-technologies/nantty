import type { AdEvent } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

export const receivedMockAdEvents: AdEvent[] = [];

export const adEventsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/ads/events", ({ body }) => {
    const { events } = body as { events: AdEvent[] };
    receivedMockAdEvents.push(...events);
  }),
];
