import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { NEEDS_APP_BUILD_MESSAGE, useCreatorStoreSubscription } from "../creatorStoreSubscription.hook";

const mockAvailability = { current: { kind: "needsAppBuild" } as Record<string, unknown> };
const mockPurchase = jest.fn();

jest.mock("@/services/core/apiClient.service", () => ({ generateIdempotencyKey: () => "intent-key", api: {} }));
jest.mock("@/services/money/nativeStoreBilling.service", () => ({ resolveStoreBillingAvailability: () => mockAvailability.current }));
jest.mock("@/services/money/creatorStorePurchase.service", () => ({
  fetchStoreDisplayPrice: jest.fn(async () => "₦1,500.00"),
  purchaseCreatorSubscriptionInStore: (...args: unknown[]) => mockPurchase(...args),
  restoreCreatorStoreSubscriptions: jest.fn(async () => []),
}));

let client: QueryClient;

function renderStoreHook() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useCreatorStoreSubscription("creator-1", "nantty.creatorsub.tier_1000.s1.monthly"), { wrapper });
}

describe("useCreatorStoreSubscription", () => {
  beforeEach(() => mockPurchase.mockReset());
  afterEach(() => client.clear());

  it("explains that Expo Go needs the app build instead of crashing", async () => {
    mockAvailability.current = { kind: "needsAppBuild" };
    const { result } = await renderStoreHook();
    expect(result.current.availability).toBe("needsAppBuild");
    expect(result.current.storeDisplayPrice).toBeNull();
    await act(async () => {
      await expect(result.current.subscribe.mutateAsync("plan-1")).rejects.toThrow(NEEDS_APP_BUILD_MESSAGE);
      await expect(result.current.restore.mutateAsync()).rejects.toThrow(NEEDS_APP_BUILD_MESSAGE);
    });
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it("shows the store's localized price and buys through the store when the native module is ready", async () => {
    mockAvailability.current = { kind: "ready", platform: "ios", billing: {} };
    mockPurchase.mockResolvedValue({ subscriptionId: "sub-1", status: "active" });
    const { result } = await renderStoreHook();
    await waitFor(() => expect(result.current.storeDisplayPrice).toBe("₦1,500.00"));
    await act(async () => {
      expect((await result.current.subscribe.mutateAsync("plan-1")).status).toBe("active");
    });
    expect(mockPurchase).toHaveBeenCalledWith({ billing: {}, platform: "ios" }, "creator-1", "plan-1", "intent-key");
  });
});
