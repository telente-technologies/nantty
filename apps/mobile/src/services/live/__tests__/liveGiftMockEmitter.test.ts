jest.mock("@/mocks/fixtures.mock", () => ({
  buildMockUserSummary: jest.fn((index: number) => ({ id: `viewer-${index}`, username: `viewer${index}`, name: `Viewer ${index}`, avatarUrl: null })),
}));
jest.mock("@/mocks/giftCatalog.mock", () => ({
  mockLiveGiftCatalog: [{ id: "gift-micro", animationAssetKey: "micro", displayLevel: "micro", comboable: false, priceCoins: 1 }],
}));
jest.mock("@/mocks/gifts.mock", () => ({ recordMockLiveGiftEvent: jest.fn() }));

import { buildMockUserSummary } from "@/mocks/fixtures.mock";
import { startMockLiveGiftEmitter } from "../liveGiftMockEmitter.service";

describe("mock live gift sender selection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("cycles through simulated viewer identities without using randomness", () => {
    const emit = jest.fn();
    const stop = startMockLiveGiftEmitter("live-1", "host-1", emit);

    jest.advanceTimersByTime(2_500);
    jest.advanceTimersByTime(1);
    jest.advanceTimersByTime(3_380);
    jest.advanceTimersByTime(1);

    expect(buildMockUserSummary).toHaveBeenNthCalledWith(1, 3);
    expect(buildMockUserSummary).toHaveBeenNthCalledWith(2, 4);
    expect(emit).toHaveBeenCalledTimes(2);
    stop();
  });
});
