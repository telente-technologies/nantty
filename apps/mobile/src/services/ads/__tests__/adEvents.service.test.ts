jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { addEventListener: jest.fn(), fetch: jest.fn() } }));
jest.mock("@/services/core/apiClient.service", () => ({ api: { post: jest.fn() }, generateIdempotencyKey: () => "stable-event-key-0001" }));
let mockAuthUserId = "account-1";
jest.mock("expo-crypto", () => ({ CryptoDigestAlgorithm: { SHA256: "SHA256" }, digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `${value}-hash`) }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: { getState: () => ({ status: "signedIn", user: { id: mockAuthUserId }, accessToken: "" }) } }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "@/services/core/apiClient.service";
import { adEventsService, recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "../adEvents.service";

describe("feed ad viewability events", () => {
  it("uses the existing minimum visibility rule and tracks only rows reported viewable", () => {
    const record = jest.spyOn(adEventsService, "recordSponsoredImpressionOncePerSession").mockImplementation(() => undefined);
    const sponsored = { campaignId: "ad-1", label: "Sponsored" as const, advertiserName: "Ada Atelier", impressionToken: "signed-token" };

    expect(sponsoredImpressionViewabilityConfig).toEqual({ itemVisiblePercentThreshold: 50, minimumViewTime: 1_000 });
    recordImpressionsForViewableSponsoredItems([
      { isViewable: false, item: { id: "ad-offscreen", sponsored } },
      { isViewable: true, item: { id: "ad-visible", sponsored } },
      { isViewable: true, item: { post: { id: "ad-feed-row", sponsored } } },
      { isViewable: true, item: { type: "product-ad", id: "feed-ad-1", ad: { adId: "feed-ad-1" }, sponsored } },
    ], "feed");

    expect(record.mock.calls).toEqual([
      [sponsored, "feed", "ad-visible"],
      [sponsored, "feed", "ad-feed-row"],
      [sponsored, "feed", "feed-ad-1"],
    ]);
    record.mockRestore();
  });

  it("retries queued ad events with a stable idempotency key", async () => {
    jest.useFakeTimers();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    jest.mocked(api.post).mockResolvedValue(undefined);

    const sponsored = { campaignId: "ad-queue-test", label: "Sponsored" as const, advertiserName: "Ada Atelier", impressionToken: "signed-token" };
    adEventsService.recordSponsoredClick(sponsored, "feed", "post-queue-test");
    await adEventsService.flushPendingAdEventsNow();

    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/ads/events",
      { events: [expect.objectContaining({ eventId: "stable-event-key-0001", campaignId: "ad-queue-test", type: "click" })] },
      { idempotencyKey: "stable-event-key-0001" },
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "zm.pendingAdEvents.account.account-1-hash",
      expect.stringContaining('"eventId":"stable-event-key-0001"'),
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("zm.pendingAdEvents");

    mockAuthUserId = "account-2";
    await adEventsService.flushPendingAdEventsNow();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("zm.pendingAdEvents.account.account-2-hash");
    mockAuthUserId = "account-1";
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
