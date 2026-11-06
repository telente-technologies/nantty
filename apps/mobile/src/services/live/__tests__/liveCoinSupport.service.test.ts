const mockPatch = jest.fn();
const mockIdempotencyKey = jest.fn(() => "coin-support-key");

jest.mock("../../core/apiClient.service", () => ({
  api: { patch: (...args: unknown[]) => mockPatch(...args) },
  generateIdempotencyKey: () => mockIdempotencyKey(),
}));

import { liveService } from "../live.service";

describe("live coin support service", () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockIdempotencyKey.mockClear();
  });

  it("PATCHes the agreed host setting contract with a generated idempotency key", async () => {
    const result = { liveId: "live-1", giftsEnabled: true };
    mockPatch.mockResolvedValue(result);

    await expect(liveService.setCoinSupport("live-1", true)).resolves.toBe(result);
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/lives/live-1/coin-support", { enabled: true }, { idempotencyKey: "coin-support-key" });
    expect(mockIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it("supports a caller-stable idempotency key for retrying the same setting", async () => {
    mockPatch.mockResolvedValue({ liveId: "live-1", giftsEnabled: false });

    await liveService.setCoinSupport("live-1", false, "stable-retry-key");

    expect(mockPatch).toHaveBeenCalledWith("/api/v1/lives/live-1/coin-support", { enabled: false }, { idempotencyKey: "stable-retry-key" });
    expect(mockIdempotencyKey).not.toHaveBeenCalled();
  });
});
