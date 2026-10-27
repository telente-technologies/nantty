const mockPost = jest.fn();

jest.mock("@/services/apiClient.service", () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock("@/config/api.config", () => ({ apiConfig: { baseUrl: "https://api.nantty.test" }, shouldUseMockForPath: () => false }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: { getState: () => ({ accessToken: "session-access-token" }) } }));
jest.mock("../realtimeMockEmitter.service", () => ({ startMockRealtimeEventEmitter: () => () => undefined }));

import { buildRealtimeWebSocketUrl, fetchRealtimeSocketToken } from "../realtime.service";

describe("realtime socket token", () => {
  beforeEach(() => mockPost.mockReset());

  it("asks the auth service for a short-lived realtime token instead of reusing the session access token", async () => {
    mockPost.mockResolvedValue({ realtimeToken: "rt-1", expiresIn: 90, scope: "realtime" });
    expect(await fetchRealtimeSocketToken()).toBe("rt-1");
    expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/realtime-token");
  });

  it("refuses anything that isn't a realtime-scoped token, and failures", async () => {
    mockPost.mockResolvedValueOnce({ realtimeToken: "w-1", scope: "widgets:read" });
    expect(await fetchRealtimeSocketToken()).toBeNull();
    mockPost.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchRealtimeSocketToken()).toBeNull();
  });

  it("builds the socket url from the API base", () => {
    expect(buildRealtimeWebSocketUrl("https://api.nantty.test/")).toBe("wss://api.nantty.test/ws");
  });
});
