import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@/services/sellers/products.service", () => ({ productsService: { fetchProductsYouMightLike: jest.fn() } }));
jest.mock("@/services/sellers/productInteractions.service", () => ({ trackProductInteraction: jest.fn() }));
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
    return React.createElement(Native.View, null,
      React.createElement(Native.Text, null, message),
      React.createElement(Native.Pressable, { accessibilityRole: "button", accessibilityLabel: "Retry recommendations", disabled: retrying, onPress: onRetry }, React.createElement(Native.Text, null, "Retry")),
    );
  },
}));
jest.mock("@/components/product/productCard", () => ({ ProductCard: () => null }));
jest.mock("@/components/product/variantPickerSheet", () => ({ VariantPickerSheet: () => null }));

import { ProductsYouMightLike } from "@/components/home/productsYouMightLike";
import { productsService } from "@/services/sellers/products.service";

const clients: QueryClient[] = [];

afterEach(async () => {
  cleanup();
  const previous = clients.splice(0);
  await Promise.all(previous.map((client) => client.cancelQueries()));
  previous.forEach((client) => client.clear());
  jest.clearAllMocks();
});

test("a failed recommendation request can be retried without replacing Mart", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  jest.mocked(productsService.fetchProductsYouMightLike)
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce({
      products: [{ id: "product_1", name: "Handwoven Tote", price: { amountMinor: 500000, currency: "NGN" }, imageUrl: null, hasVariants: false }],
      source: "popular",
    });

  const view = await render(createElement(QueryClientProvider, { client }, createElement(ProductsYouMightLike)));
  expect(await view.findByText("Couldn't load product recommendations.")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("Retry recommendations"));
  expect(await view.findByText("Products you might like")).toBeTruthy();
  expect(productsService.fetchProductsYouMightLike).toHaveBeenCalledTimes(2);
});
