import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockFetchProductReviews = jest.fn();
let mockSummaryData: { count: number; average: number; distribution: never[] } | null = { count: 2, average: 4.5, distribution: [] };

jest.mock("@/services/catalog/reviews.service", () => ({
  reviewsService: {
    fetchProductReviews: (...args: unknown[]) => mockFetchProductReviews(...args),
  },
}));
jest.mock("@/components/reviews/reviewQueries.hook", () => ({
  reviewQueryKeys: { list: (productId: string) => ["products", "reviews", productId, "list"] },
  useDeleteOwnReview: () => ({ confirmDelete: jest.fn() }),
  useRatingSummaryQuery: () => ({ data: mockSummaryData, refetch: jest.fn() }),
  useViewerAccountId: () => null,
}));
jest.mock("@/components/reviews/ratingSummary", () => ({ RatingSummary: ({ summary }: { summary: { average: number; count: number } }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, `rating:${summary.average}:${summary.count}`);
} }));
jest.mock("@/components/reviews/reviewRow", () => ({
  ReviewRow: ({ review }: { review: { title: string | null } }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(ReactNative.Text, null, review.title);
  },
}));
jest.mock("@/components/icons", () => ({ StarOutline16Icon: () => null }));
jest.mock("@/components/ui/brandLoader", () => ({ BrandLoader: () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, "Loading more reviews");
} }));
jest.mock("@/components/ui/emptyState", () => ({ EmptyState: () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, "No reviews yet");
} }));
jest.mock("@/components/ui/errorState", () => ({
  ErrorState: ({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(ReactNative.View, null,
      React.createElement(ReactNative.Text, null, message),
      React.createElement(ReactNative.Pressable, { accessibilityRole: "button", accessibilityLabel: "Retry loading reviews", disabled: retrying, onPress: onRetry }, React.createElement(ReactNative.Text, null, "Try again")),
    );
  },
}));
jest.mock("@/components/ui/header", () => ({ Header: ({ title }: { title: string }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, title);
} }));
jest.mock("@/components/ui/listSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/ui/pullToRefresh.hook", () => ({ usePullToRefresh: () => undefined }));
jest.mock("@/components/ui/screen", () => ({ Screen: ({ children }: { children: ReactNode }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.View, null, children);
} }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { textMuted: "muted" } }),
  makeThemedStyles: (create: (colors: unknown) => unknown) => () => create({ divider: "divider" }),
}));

import { ProductReviewsScreen } from "./productReviews.screen";

const page = (titles: string[], nextCursor: string | null) => ({
  reviews: titles.map((title, index) => ({
    id: `${title}-${index}`,
    author: { id: `author-${index}`, name: `Buyer ${index}`, username: `buyer-${index}`, avatarUrl: null },
    rating: 5,
    title,
    text: "Fits the listing.",
    createdAt: "2026-11-01T12:00:00.000Z",
    isVerifiedPurchase: true,
    reply: null,
  })),
  count: 2,
  average: 4.5,
  nextCursor,
});

describe("ProductReviewsScreen pagination recovery", () => {
  beforeEach(() => {
    mockFetchProductReviews.mockReset();
    mockSummaryData = { count: 2, average: 4.5, distribution: [] };
  });

  it("falls back to review-page metrics when the summary endpoint is unavailable", async () => {
    mockSummaryData = null;
    mockFetchProductReviews.mockResolvedValueOnce(page(["First review"], null));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

    const view = await render(
      <QueryClientProvider client={client}>
        <ProductReviewsScreen
          navigation={{} as never}
          route={{ key: "ProductReviews", name: "ProductReviews", params: { productId: "product-1" } } as never}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(view.getByText("rating:4.5:2")).toBeTruthy());
    await client.cancelQueries();
    client.clear();
  });

  it("keeps loaded reviews and exposes an explicit retry after a later page fails", async () => {
    mockFetchProductReviews
      .mockResolvedValueOnce(page(["First review"], "next-page"))
      .mockRejectedValueOnce(new Error("Temporary review service failure"))
      .mockResolvedValueOnce(page(["Second review"], null));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

    const view = await render(
      <QueryClientProvider client={client}>
        <ProductReviewsScreen
          navigation={{} as never}
          route={{ key: "ProductReviews", name: "ProductReviews", params: { productId: "product-1" } } as never}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(view.getByText("First review")).toBeTruthy());
    fireEvent(view.getByTestId("product-reviews-list"), "onEndReached");
    await waitFor(() => expect(view.getByText("Couldn't load more reviews.")).toBeTruthy());

    fireEvent.press(view.getByRole("button", { name: "Retry loading reviews" }));
    await waitFor(() => expect(view.getByText("Second review")).toBeTruthy());
    expect(view.getByText("First review")).toBeTruthy();
    expect(mockFetchProductReviews).toHaveBeenNthCalledWith(3, "product-1", "next-page");

    await client.cancelQueries();
    client.clear();
  });
});
