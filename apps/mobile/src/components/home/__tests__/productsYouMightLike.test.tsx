import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import { ProductsYouMightLike, productsYouMightLikeQueryKey } from "@/components/home/productsYouMightLike";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import type { ProductSummary } from "@/types";

jest.mock("@/services/sellers/products.service", () => ({ productsService: { fetchProductsYouMightLike: jest.fn() } }));
jest.mock("@/services/sellers/productInteractions.service", () => ({ trackProductInteraction: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isLoading: true, isError: false, data: undefined }) }));
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
const secondProduct: ProductSummary = { ...product, id: "product_2", name: "Woven Scarf" };

const renderSection = async (
  interactionSurface?: "mart_recommendations" | "feed_recommendations" | "clips_recommendations",
  optional = false,
  recommendations: Record<string, unknown> = { isLoading: false, isError: false, data: { products: [product], source: "personalized" } },
  presentation: "shelf" | "clips" = "shelf",
) => {
  return await render(createElement(ProductsYouMightLike, {
    interactionSurface,
    optional,
    presentation,
    recommendations: recommendations as never,
  }));
};

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test("shows loading state while recommendations are requested", async () => {
  const view = await renderSection(undefined, false, { isLoading: true, isError: false, data: undefined });
  expect(view.getByTestId("productsYouMightLikeLoading")).toBeTruthy();
});

test("renders recommended products and hides the section for an empty response", async () => {
  const populated = await renderSection();
  expect(populated.getByLabelText("Open Handwoven Tote")).toBeTruthy();
  expect(populated.getByText("Handwoven Tote")).toBeTruthy();
  await populated.unmount();

  const empty = await renderSection(undefined, false, { isLoading: false, isError: false, data: { products: [], source: "popular" } });
  expect(empty.queryByTestId("productsYouMightLike")).toBeNull();
  await empty.unmount();
});

test("tracks the organic feed recommendation click surface and opens product detail", async () => {
  const view = await renderSection("feed_recommendations", false, {
    isLoading: false,
    isError: false,
    data: { products: [product, secondProduct], source: "personalized" },
  });

  fireEvent.press(view.getByLabelText("Open Woven Scarf"));

  expect(trackProductInteraction).toHaveBeenCalledWith("product.clicked", { productId: "product_2", position: 1, surface: "feed_recommendations" });
  expect(mockNavigate).toHaveBeenCalledWith("ProductDetail", { productId: "product_2" });
});

test("uses a swipe-snapping horizontal carousel presentation for Clips recommendations", async () => {
  const view = await renderSection("feed_recommendations", false, undefined, "clips");
  const carousel = view.getByTestId("clipsProductRecommendationsCarousel");

  expect(carousel.props.horizontal).toBe(true);
  expect(carousel.props.snapToInterval).toBeGreaterThan(0);
  expect(carousel.props.snapToAlignment).toBe("start");
  expect(carousel.props.decelerationRate).toBe("fast");
  expect(carousel.props.nestedScrollEnabled).toBe(true);
});

test("tracks Clips carousel clicks with the consent-gated Clips surface", async () => {
  const view = await renderSection("clips_recommendations", false, {
    isLoading: false,
    isError: false,
    data: { products: [product], source: "personalized" },
  }, "clips");

  fireEvent.press(view.getByLabelText("Open Handwoven Tote"));

  expect(trackProductInteraction).toHaveBeenCalledWith("product.clicked", {
    productId: "product_1",
    position: 0,
    surface: "clips_recommendations",
  });
});

test("keeps loading and failed optional feed recommendations silent", async () => {
  const loading = await render(createElement(ProductsYouMightLike, {
    recommendations: { isLoading: true, isError: false, data: undefined } as never,
    interactionSurface: "feed_recommendations",
    optional: true,
  }));
  expect(loading.queryByTestId("productsYouMightLikeLoading")).toBeNull();
  await loading.unmount();

  const failed = await render(createElement(ProductsYouMightLike, {
    recommendations: { isLoading: false, isError: true, data: undefined, error: new Error("unavailable") } as never,
    interactionSurface: "feed_recommendations",
    optional: true,
  }));
  expect(failed.queryByTestId("productsYouMightLikeError")).toBeNull();
  expect(failed.queryByTestId("productsYouMightLike")).toBeNull();
  await failed.unmount();
});

test("does not reuse another account's personalized recommendation cache", () => {
  expect(productsYouMightLikeQueryKey("account-1")).not.toEqual(productsYouMightLikeQueryKey("account-2"));
  expect(productsYouMightLikeQueryKey("account-1", "for_you")).not.toEqual(productsYouMightLikeQueryKey("account-1", "mart_home"));
});

