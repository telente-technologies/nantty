import { fireEvent, render, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();
const mockTrackProductInteraction = jest.fn();

jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("@/hooks/useCart.hook", () => ({ useCartActions: () => ({ addProductToCart: { mutate: jest.fn() } }) }));
jest.mock("@/utils/requireAuth.util", () => ({ requireAuthThen: (action: () => void) => action() }));
jest.mock("@/services/sellers/productInteractions.service", () => ({ trackProductInteraction: (...args: unknown[]) => mockTrackProductInteraction(...args) }));
jest.mock("@/components/product/variantPickerSheet", () => ({ VariantPickerSheet: () => null }));
jest.mock("@/components/product/productCard", () => ({
  ProductCard: ({ product, onPress }: { product: { id: string; name: string }; onPress: () => void }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const Native = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(Native.Pressable, { accessibilityRole: "button", accessibilityLabel: `Open ${product.name}`, onPress }, React.createElement(Native.Text, null, product.name));
  },
}));

import { ProductMasonry } from "./productMasonry";
import type { ProductSummary } from "@/types";

const products: ProductSummary[] = [
  { id: "product_1", name: "Handwoven Tote", price: { amountMinor: 500_000, currency: "NGN" }, imageUrl: null, hasVariants: false },
  { id: "product_2", name: "Woven Scarf", price: { amountMinor: 250_000, currency: "NGN" }, imageUrl: null, hasVariants: false },
  { id: "product_3", name: "Leather Sandals", price: { amountMinor: 1_500_000, currency: "NGN" }, imageUrl: null, hasVariants: false },
];

afterEach(() => jest.clearAllMocks());

describe("ProductMasonry interaction positions", () => {
  it("retains the server-ranked position after products are split into columns", async () => {
    await render(<ProductMasonry products={products} interactionSurface="mart_home" />);

    fireEvent.press(screen.getByLabelText("Open Woven Scarf"));

    expect(mockTrackProductInteraction).toHaveBeenCalledWith("product.clicked", {
      productId: "product_2",
      position: 1,
      surface: "mart_home",
    });
    expect(mockNavigate).toHaveBeenCalledWith("ProductDetail", { productId: "product_2" });
  });

  it("retains ranked position and query context for search results", async () => {
    await render(<ProductMasonry products={products} adPlacement="search" searchQuery="woven bag" searchResultCount={14} />);

    fireEvent.press(screen.getByLabelText("Open Leather Sandals"));

    expect(mockTrackProductInteraction).toHaveBeenCalledWith("product.clicked", {
      productId: "product_3",
      position: 2,
      surface: "search",
      query: "woven bag",
      resultCount: 14,
    });
  });
});
