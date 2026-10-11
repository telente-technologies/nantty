import { ApiError } from "@/errors/api.error";

import { classifyHeartbeatOutcome } from "../liveHostConnection.util";

const heartbeat = (status: "live" | "ended") => ({ heartbeat: { liveId: "l1", status, leaseExpiresAt: null, timeoutSeconds: 60 } });

describe("host heartbeat outcomes", () => {
  it("stays connected while the live is running and leaves for the summary once it ended", () => {
    expect(classifyHeartbeatOutcome(heartbeat("live"))).toBe("connected");
    expect(classifyHeartbeatOutcome(heartbeat("ended"))).toBe("ended");
  });

  it("shows reconnecting (not an error) when the network drops or the server hiccups", () => {
    expect(classifyHeartbeatOutcome({ error: new TypeError("Network request failed") })).toBe("reconnecting");
    expect(classifyHeartbeatOutcome({ error: new ApiError(503, "Unavailable") })).toBe("reconnecting");
    expect(classifyHeartbeatOutcome({ error: new ApiError(429, "Slow down") })).toBe("reconnecting");
  });

  it("stops quietly on permanent refusals and treats a vanished live as ended", () => {
    expect(classifyHeartbeatOutcome({ error: new ApiError(403, "Only the host can do that.", "NOT_LIVE_HOST") })).toBe("stop");
    expect(classifyHeartbeatOutcome({ error: new ApiError(404, "Not found", "LIVE_NOT_FOUND") })).toBe("ended");
  });
});
