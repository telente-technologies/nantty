import { fireEvent, render, screen } from "@testing-library/react-native";

const mockSummaryRefetch = jest.fn();
const mockPreviewRefetch = jest.fn();
let mockSummary: Record<string, unknown>;
let mockPreview: Record<string, unknown>;

jest.mock("@/components/reviews/reviewQueries.hook", () => ({
  useRatingSummaryQuery: () => mockSummary,
  useReviewPreviewQuery: () => mockPreview,
  useViewerAccountId: () => null,
}));
jest.mock("@/components/icons", () => ({ StarOutline16Icon: () => null }));
jest.mock("@/components/ui/button", () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(ReactNative.Pressable, { accessibilityRole: "button", onPress }, React.createElement(ReactNative.Text, null, title));
  },
}));
jest.mock("@/components/ui/emptyState", () => ({ EmptyState: ({ title }: { title: string }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, title);
} }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.View, null,
    React.createElement(ReactNative.Text, null, message),
    React.createElement(ReactNative.Pressable, { accessibilityRole: "button", accessibilityLabel: "Retry reviews", onPress: onRetry }, React.createElement(ReactNative.Text, null, "Try again")),
  );
} }));
jest.mock("@/components/ui/brandLoader", () => ({ BrandLoader: ({ accessibilityLabel }: { accessibilityLabel: string }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, { accessibilityLabel }, "Loading");
} }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: React.ReactNode }) => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return React.createElement(ReactNative.Text, null, children);
} }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { textSubtle: "subtle" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ divider: "divider" }),
}));
jest.mock("./ratingSummary", () => ({ RatingSummary: () => null }));
jest.mock("./reviewRow", () => ({ ReviewRow: () => null }));
jest.mock("./starRating", () => ({ StarRating: () => null }));

import { ProductReviewsSection } from "./productReviewsSection";

describe("ProductReviewsSection recovery and fallback", () => {
  beforeEach(() => {
    mockSummaryRefetch.mockReset();
    mockPreviewRefetch.mockReset();
    mockSummary = { data: undefined, error: undefined, isPending: false, isError: false, refetch: mockSummaryRefetch };
    mockPreview = { data: undefined, error: undefined, isPending: false, isError: false, isSuccess: false, refetch: mockPreviewRefetch };
  });

  it("shows a loading state while both summary and review preview are pending", async () => {
    mockSummary = { ...mockSummary, isPending: true };
    mockPreview = { ...mockPreview, isPending: true };
    await render(<ProductReviewsSection productId="product-1" onSeeAll={jest.fn()} />);

    expect(screen.getByLabelText("Loading product reviews")).toBeTruthy();
  });

  it("offers an accessible retry when review preview loading fails", async () => {
    mockPreview = { ...mockPreview, error: new Error("offline"), isError: true };
    await render(<ProductReviewsSection productId="product-1" onSeeAll={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Retry reviews" }));
    expect(mockPreviewRefetch).toHaveBeenCalledTimes(1);
    expect(mockSummaryRefetch).toHaveBeenCalledTimes(1);
  });

  it("uses the review page average when the separate rating summary fails", async () => {
    mockSummary = { ...mockSummary, error: new Error("summary unavailable"), isError: true };
    mockPreview = { ...mockPreview, data: { average: 4.5, count: 4, reviews: [] }, isSuccess: true };
    await render(<ProductReviewsSection productId="product-1" onSeeAll={jest.fn()} />);

    expect(screen.getByLabelText("Rated 4.5 from 4 reviews")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See all 4 reviews" })).toBeTruthy();
  });
});
