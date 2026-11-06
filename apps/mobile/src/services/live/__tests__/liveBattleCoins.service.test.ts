const mockPost = jest.fn();
const mockIdempotencyKey = jest.fn(() => "battle-contribution-key");

jest.mock("../../core/apiClient.service", () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
  generateIdempotencyKey: () => mockIdempotencyKey(),
}));

import type { LiveStage } from "@/types/liveStage.type";
import { liveGuestsService } from "../liveGuests.service";

describe("live battle coin contributions", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockIdempotencyKey.mockClear();
  });

  it("posts the recipient and coin amount with the generated idempotency key and returns the refreshed stage", async () => {
    const refreshedStage = { liveId: "live-1", activeBattle: { id: "battle-1" } } as LiveStage;
    mockPost.mockResolvedValue(refreshedStage);

    const response = await liveGuestsService.contributeBattleCoins("battle-1", { recipientUserId: "user-2", coins: 125 });

    expect(mockPost).toHaveBeenCalledWith("/api/v1/battles/battle-1/coins", { recipientUserId: "user-2", coins: 125 }, { idempotencyKey: "battle-contribution-key" });
    expect(mockIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(response).toBe(refreshedStage);
  });

  it("uses a caller-stable idempotency key when retrying an uncertain contribution", async () => {
    mockPost.mockResolvedValue({ liveId: "live-1" });

    await liveGuestsService.contributeBattleCoins("battle-1", { recipientUserId: "user-2", coins: 125 }, "stable-retry-key");

    expect(mockPost).toHaveBeenCalledWith("/api/v1/battles/battle-1/coins", { recipientUserId: "user-2", coins: 125 }, { idempotencyKey: "stable-retry-key" });
    expect(mockIdempotencyKey).not.toHaveBeenCalled();
  });
});
