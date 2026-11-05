import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

const mockFetchProductsPage = jest.fn();
const mockFetchProductCollectionPage = jest.fn();
const mockTrackProductInteraction = jest.fn();

jest.mock("@/services/sellers/products.service", () => ({
  productsService: {
    fetchProductsPage: (...args: unknown[]) => mockFetchProductsPage(...args),
    fetchProductCollectionPage: (...args: unknown[]) => mockFetchProductCollectionPage(...args),
  },
}));
jest.mock("@/services/sellers/productInteractions.service", () => ({
  trackProductInteraction: (...args: unknown[]) => mockTrackProductInteraction(...args),
}));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { surface: "white", textMuted: "gray" } }) }));
jest.mock("@/components/home/productMasonry", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ProductMasonry: ({ products }: { products: readonly { id: string; name: string }[] }) =>
      React.createElement(ReactNative.View, null, ...products.map((product) => React.createElement(ReactNative.Text, { key: product.id }, product.name))),
  };
});
jest.mock("@/components/icons", () => ({ ShoppingCart24Icon: () => null }));
jest.mock("@/components/ui/brandLoader", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return { BrandLoader: () => React.createElement(ReactNative.Text, null, "Loading more") };
});
jest.mock("@/components/ui/emptyState", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    EmptyState: ({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel: string; onAction: () => void }) =>
      React.createElement(ReactNative.View, null, React.createElement(ReactNative.Text, null, title), React.createElement(ReactNative.Text, null, body),
        React.createElement(ReactNative.Pressable, { accessibilityRole: "button", onPress: onAction }, React.createElement(ReactNative.Text, null, actionLabel))),
  };
});
jest.mock("@/components/ui/errorState", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ErrorState: ({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) =>
      React.createElement(ReactNative.View, null, React.createElement(ReactNative.Text, null, message),
        React.createElement(ReactNative.Pressable, { accessibilityRole: "button", accessibilityLabel: "Retry loading products", disabled: retrying, onPress: onRetry },
          React.createElement(ReactNative.Text, null, retrying ? "Retrying" : "Try again"))),
  };
});
jest.mock("@/components/ui/gridSkeleton", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return { GridSkeleton: () => React.createElement(ReactNative.Text, null, "Loading products") };
});
jest.mock("@/components/ui/header", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return { Header: ({ title }: { title: string }) => React.createElement(ReactNative.Text, null, title) };
});
jest.mock("@/components/ui/pullToRefresh.hook", () => ({ usePullToRefresh: () => undefined }));
jest.mock("@/components/ui/screen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const ReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return { Screen: ({ children }: { children: ReactNode }) => React.createElement(ReactNative.View, null, children) };
});

import { CategoryScreen } from "./category.screen";

const page = (data: { id: string; name: string }[], nextCursor: string | null) => ({ data, nextCursor });

describe("CategoryScreen result flow", () => {
  let client: QueryClient;
  const navigation = { navigate: jest.fn() };
  const renderCategory = async (params: { categoryId: string; name: string; collection?: "sales_of_the_day" | "featured_brands" | "new_arrivals" }) => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    return render(createElement(CategoryScreen, { navigation, route: { params } } as never), { wrapper });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => client?.clear());

  it("uses the category ID for the first page and tracks the viewed category", async () => {
    mockFetchProductsPage.mockResolvedValue(page([{ id: "product-1", name: "Woven tote" }], null));
    const view = await renderCategory({ categoryId: "category-from-api", name: "Bags" });

    await waitFor(() => expect(view.getByText("Woven tote")).toBeTruthy());
    expect(mockFetchProductsPage).toHaveBeenCalledWith("category-from-api", null);
    expect(mockTrackProductInteraction).toHaveBeenCalledWith("category.viewed", { categoryId: "category-from-api" });
  });

  it("shows a retry action after a later page fails and resumes with the same cursor", async () => {
    mockFetchProductsPage
      .mockResolvedValueOnce(page([{ id: "product-1", name: "Woven tote" }], "cursor-from-api"))
      .mockRejectedValueOnce(new Error("Temporary page failure"))
      .mockResolvedValueOnce(page([{ id: "product-2", name: "Indigo scarf" }], null));
    const view = await renderCategory({ categoryId: "category-from-api", name: "Bags" });

    await waitFor(() => expect(view.getByText("Woven tote")).toBeTruthy());
    fireEvent(view.getByTestId("category-product-list"), "onEndReached");
    await waitFor(() => expect(view.getByText("Couldn't load more products.")).toBeTruthy());

    fireEvent.press(view.getByRole("button", { name: "Retry loading products" }));
    await waitFor(() => expect(view.getByText("Indigo scarf")).toBeTruthy());
    expect(mockFetchProductsPage).toHaveBeenNthCalledWith(3, "category-from-api", "cursor-from-api");
    expect(view.getByText("Woven tote")).toBeTruthy();
  });

  it("recovers from an initial category load error without changing the requested category", async () => {
    mockFetchProductsPage
      .mockRejectedValueOnce(new Error("Temporary category failure"))
      .mockResolvedValueOnce(page([{ id: "product-1", name: "Woven tote" }], null));
    const view = await renderCategory({ categoryId: "category-from-api", name: "Bags" });

    await waitFor(() => expect(view.getByText("Couldn't load products.")).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Retry loading products" }));
    await waitFor(() => expect(view.getByText("Woven tote")).toBeTruthy());
    expect(mockFetchProductsPage).toHaveBeenNthCalledWith(2, "category-from-api", null);
  });

  it("routes an empty category to Mart search and uses the server collection key when supplied", async () => {
    mockFetchProductCollectionPage.mockResolvedValue(page([], null));
    const view = await renderCategory({ categoryId: "not-used-for-collection", name: "Featured", collection: "featured_brands" });

    await waitFor(() => expect(view.getByText("Nothing here yet")).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Search the mart" }));
    expect(navigation.navigate).toHaveBeenCalledWith("Search", { scope: "mart" });
    expect(mockFetchProductCollectionPage).toHaveBeenCalledWith("featured_brands", null);
    expect(mockFetchProductsPage).not.toHaveBeenCalled();
  });
});
