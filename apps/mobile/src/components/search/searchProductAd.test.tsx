import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react-native";

import { SearchProductAd } from "./searchProductAd";

const mockDecideSearchProductAd = jest.fn();

jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (selector: (state: { status: string; user: { id: string } }) => unknown) => selector({ status: "signedIn", user: { id: "viewer-1" } }),
}));
jest.mock("@/services/ads/productAds.service", () => ({
  productAdsService: { decideSearchProductAd: (...args: unknown[]) => mockDecideSearchProductAd(...args) },
  usableSearchProductAd: () => false,
}));
jest.mock("@/components/ads/feedProductAdCard", () => ({ FeedProductAdCard: () => null }));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test("reuses one server decision for a mounted search query instead of issuing duplicate ad requests", async () => {
  mockDecideSearchProductAd.mockResolvedValue({ ad: null, receivedAt: Date.now() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const renderAd = (query = "woven bags") => createElement(QueryClientProvider, { client }, createElement(SearchProductAd, { query, scope: "global" }));
  const rendered = await render(renderAd());

  await waitFor(() => expect(mockDecideSearchProductAd).toHaveBeenCalledTimes(1));
  await act(async () => {
    rendered.rerender(renderAd());
    await Promise.resolve();
  });
  rendered.unmount();
  const remounted = await render(renderAd());

  await waitFor(() => expect(mockDecideSearchProductAd).toHaveBeenCalledTimes(1));
  remounted.unmount();
  client.clear();
});
