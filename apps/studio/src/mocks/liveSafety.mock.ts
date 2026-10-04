import type { LiveSafetyState, StageGuest } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const MOCK_PAUSED_LIVE_ID = "live_safety_paused";
const appealed = new Set<string>();

const readMockSafety = (liveId: string): LiveSafetyState | null =>
  liveId === MOCK_PAUSED_LIVE_ID
    ? { state: "paused", viewerMessage: "This live is paused while we review it", heldAt: new Date(Date.now() - 120_000).toISOString(), appealable: !appealed.has(liveId), hostReason: "We paused your live because it may show nudity or sexual content.", category: "sexual_explicit" }
    : null;

const MOCK_GUESTS: readonly StageGuest[] = [
  { slotId: "slot_1", role: "guest", state: "onStage", user: { id: "u_guest_1", name: "Bisola Ade", username: "bisola.ade", avatarUrl: null } },
];

export const liveSafetyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/:liveId/safety", ({ params }) => ({ safety: readMockSafety(params.liveId!) })),
  createMockRoute("GET", "/api/v1/lives/:liveId/stage", () => ({ streamers: MOCK_GUESTS })),
  createMockRoute("POST", "/api/v1/live-safety/:liveId/appeal", ({ params }) => {
    appealed.add(params.liveId!);
    return { status: "received", incidentId: `inc_${params.liveId!}` };
  }),
  createMockRoute("POST", "/api/v1/reports", () => ({ id: `rep_${Date.now().toString(36)}`, status: "received" })),
];
