import { resolveMockApiRequest } from "@/mocks";
import type { LiveHostHeartbeat } from "@/services/live/live.service";
import type { LiveSessionDetails } from "@/types";
import { readRunningLiveId } from "@/utils/liveStoreErrors.util";

jest.setTimeout(20000);

const failureOf = (request: Promise<unknown>) => request.catch((error: unknown) => error);

describe("go-live flow against the mobile mocks", () => {
  it("creates one live, survives a double tap, heartbeats, ends twice and shows the summary", async () => {
    const live = await resolveMockApiRequest<LiveSessionDetails>("POST", "/api/v1/lives", { title: "Mock live", category: "justChatting" });
    expect(live.status).toBe("live");

    const secondTap = await failureOf(resolveMockApiRequest("POST", "/api/v1/lives", { title: "Mock live", category: "justChatting" }));
    expect(secondTap).toMatchObject({ status: 409, code: "LIVE_ALREADY_RUNNING" });
    expect(readRunningLiveId(secondTap)).toBe(live.id);

    const beat = await resolveMockApiRequest<LiveHostHeartbeat>("POST", `/api/v1/lives/${live.id}/heartbeat`, undefined);
    expect(beat).toMatchObject({ liveId: live.id, status: "live", timeoutSeconds: 60 });

    for (const path of ["comments", "stage", "safety", "leaderboard", "gift-goals", "points/me"]) {
      await expect(resolveMockApiRequest("GET", `/api/v1/lives/${live.id}/${path}`, undefined)).resolves.toBeDefined();
    }
    await resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/comments`, { text: "hello" });

    await resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/end`, undefined);
    await resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/end`, undefined);
    const ended = await resolveMockApiRequest<LiveSessionDetails>("GET", `/api/v1/lives/${live.id}`, undefined);
    expect(ended.status).toBe("ended");
    const lateBeat = await resolveMockApiRequest<LiveHostHeartbeat>("POST", `/api/v1/lives/${live.id}/heartbeat`, undefined);
    expect(lateBeat).toMatchObject({ status: "ended", leaseExpiresAt: null });

    const next = await resolveMockApiRequest<LiveSessionDetails>("POST", "/api/v1/lives", { title: "Again", category: "justChatting" });
    expect(next.id).not.toBe(live.id);
    await resolveMockApiRequest("POST", `/api/v1/lives/${next.id}/end`, undefined);
  });
});
