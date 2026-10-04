import { ApiError } from "@/errors/api.error";
import type { LiveSafetyState } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

export const MOCK_PAUSED_LIVE_ID = "live_safety_paused";
const appealedLiveIds = new Set<string>();

export function readMockLiveSafety(liveId: string, isHost: boolean): LiveSafetyState | null {
  if (liveId !== MOCK_PAUSED_LIVE_ID) return null;
  return {
    state: "paused",
    viewerMessage: "This live is paused while we review it",
    heldAt: new Date(Date.now() - 90_000).toISOString(),
    appealable: true,
    ...(isHost ? { hostReason: "We paused your live because it may show nudity or sexual content.", category: "sexual_explicit" } : {}),
  };
}

export const liveSafetyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/:liveId/safety", ({ params }) => ({ safety: readMockLiveSafety(params.liveId!, true) })),
  createMockRoute("POST", "/api/v1/live-safety/:liveId/appeal", ({ params }) => {
    const liveId = params.liveId!;
    if (liveId !== MOCK_PAUSED_LIVE_ID) throw new ApiError(404, "There's no paused live to appeal.", "NO_ACTIVE_HOLD");
    if (appealedLiveIds.has(liveId)) throw new ApiError(409, "You've already appealed. Our safety team is reviewing your live.", "ALREADY_APPEALED");
    appealedLiveIds.add(liveId);
    return { status: "received", incidentId: `inc_${liveId}` };
  }),
];
