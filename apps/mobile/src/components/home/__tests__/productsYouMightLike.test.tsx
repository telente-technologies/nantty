import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";

import { ProductsYouMightLike, productsYouMightLikeQueryKey } from "@/components/home/productsYouMightLike";
import { productsService } from "@/services/sellers/products.service";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import type { ProductSummary } from "@/types";

jest.mock("@/services/sellers/products.service", () => ({ productsService: { fetchProductsYouMightLike: jest.fn() } }));
jest.mock("@/services/sellers/productInteractions.service", () => ({ trackProductInteraction: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("@/hooks/useCart.hook", () => ({ useCartActions: () => ({ addProductToCart: { mutate: jest.fn() } }) }));
jest.mock("@/utils/requireAuth.util", () => ({ requireAuthThen: (action: () => void) => action() }));
jest.mock("@/theme", () => ({ makeThemedStyles: (factory: (colors: { skeleton: string }) => unknown) => () => factory({ skeleton: "#eeeeee" }) }));
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const Native = jest.requireActual<typeof import("react-native")>("react-native");
  return { Text: ({ children }: { children: string }) => React.createElement(Native.Text, null, children) };
});
jest.mock("@/components/ui/errorState", () => ({
  ErrorState: ({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const Native = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(Native.View, null, React.createElement(Native.Text, null, message), React.createElement(Native.Pressable, { accessibilityRole: "button", accessibilityLabel: "Retry recommendations", disabled: retrying, onPress: onRetry }, React.createElement(Native.Text, null, "Retry")));
  },
}));
jest.mock("@/components/product/productCard", () => ({
  ProductCard: ({ product, onPress }: { product: ProductSummary; onPress: () => void }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const Native = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(Native.Pressable, { accessibilityRole: "button", accessibilityLabel: `Open ${product.name}`, onPress }, React.createElement(Native.Text, null, product.name));
  },
}));
jest.mock("@/components/product/variantPickerSheet", () => ({ VariantPickerSheet: () => null }));

const product: ProductSummary = {
  id: "product_1",
  name: "Handwoven Tote",
  price: { amountMinor: 500000, currency: "NGN" },
  imageUrl: null,
  hasVariants: false,
};

const queryClients: QueryClient[] = [];
const renderSection = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queryClients.push(client);
  return render(createElement(QueryClientProvider, { client }, createElement(ProductsYouMightLike)));
};

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((client) => client.clear());
  jest.clearAllMocks();
});

test("shows loading state while recommendations are requested", async () => {
  let resolveRecommendations!: (response: { products: readonly ProductSummary[]; source: "popular" }) => void;
  jest.mocked(productsService.fetchProductsYouMightLike).mockReturnValue(new Promise((resolve) => { resolveRecommendations = resolve; }));
  await renderSection();
  expect(screen.getByTestId("productsYouMightLikeLoading")).toBeTruthy();
  await act(async () => {
    resolveRecommendations({ products: [], source: "popular" });
    // Let TanStack Query's deferred observer notification run before act closes.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
});

test("renders recommended products and hides the section for an empty response", async () => {
  jest.mocked(productsService.fetchProductsYouMightLike).mockResolvedValueOnce({ products: [product], source: "personalized" });
  const { unmount } = await renderSection();
  expect(await screen.findByText("Products you might like")).toBeTruthy();
  expect(screen.getByText("Handwoven Tote")).toBeTruthy();
  unmount();

  jest.mocked(productsService.fetchProductsYouMightLike).mockResolvedValueOnce({ products: [], source: "popular" });
  await renderSection();
  expect(screen.queryByTestId("productsYouMightLike")).toBeNull();
});

test("tracks a recommendation click and opens its product detail", async () => {
  jest.mocked(productsService.fetchProductsYouMightLike).mockResolvedValueOnce({ products: [product], source: "personalized" });
  await renderSection();

  await fireEvent.press(await screen.findByLabelText("Open Handwoven Tote"));

  expect(trackProductInteraction).toHaveBeenCalledWith("product.clicked", { productId: "product_1", surface: "mart_recommendations" });
  expect(mockNavigate).toHaveBeenCalledWith("ProductDetail", { productId: "product_1" });
});

test("does not reuse another account's personalized recommendation cache", async () => {
  expect(productsYouMightLikeQueryKey("account-1")).not.toEqual(productsYouMightLikeQueryKey("account-2"));
});

