import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";
import { Pressable, Text as RNText, View } from "react-native";

const mockListMyStoreProducts = jest.fn();
const mockPublishStoreProduct = jest.fn();
const mockUnpublishStoreProduct = jest.fn();

jest.mock("@/services/sellers/seller.service", () => ({
  sellerService: {
    listMyStoreProducts: (...args: unknown[]) => mockListMyStoreProducts(...args),
    publishStoreProduct: (...args: unknown[]) => mockPublishStoreProduct(...args),
    unpublishStoreProduct: (...args: unknown[]) => mockUnpublishStoreProduct(...args),
  },
}));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { error: "red", textMuted: "gray" } }),
  makeThemedStyles: (factory: (colors: object) => object) => () => factory({}),
}));
jest.mock("@/store/locale.store", () => ({ useLocaleStore: () => "NGN" }));
jest.mock("@/components/seller/inventoryCard", () => ({
  InventoryCard: ({ product, onPress }: { product: { name: string }; onPress: () => void }) => createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: `Edit ${product.name}`, onPress }, createElement(RNText, null, product.name)),
}));
jest.mock("@/components/icons", () => ({ Tag24Icon: () => null }));
jest.mock("@/components/ui/button", () => ({
  Button: ({ title, onPress, disabled, loading, accessibilityLabel }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; accessibilityLabel?: string }) => createElement(
    Pressable,
    { accessibilityRole: "button", accessibilityLabel: accessibilityLabel ?? title, accessibilityState: { disabled: disabled || loading, busy: loading }, disabled: disabled || loading, onPress },
    createElement(RNText, null, title),
  ),
}));
jest.mock("@/components/ui/emptyState", () => ({ EmptyState: () => null }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: () => null }));
jest.mock("@/components/ui/gridSkeleton", () => ({ GridSkeleton: () => null }));
jest.mock("@/components/ui/header", () => ({ Header: () => null }));
jest.mock("@/components/ui/pullToRefresh.hook", () => ({ usePullToRefresh: () => undefined }));
jest.mock("@/components/ui/screen", () => ({ Screen: ({ children }: { children: ReactNode }) => createElement(View, null, children) }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children, ...props }: { children: ReactNode }) => createElement(RNText, props, children) }));

import { SellerProductsScreen } from "./sellerProducts.screen";

const product = (publishedOnline: boolean) => ({
  id: "product-1",
  name: "Woven tote",
  status: "active",
  publishedOnline,
  images: [],
  variants: [{ price: { amountMinor: 500_000, currency: "NGN" }, stock: [{ onHand: 4, reserved: 0 }] }],
}) as never;

describe("SellerProductsScreen publishing controls", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    mockListMyStoreProducts.mockResolvedValue([product(false)]);
    mockPublishStoreProduct.mockResolvedValue(product(true));
    mockUnpublishStoreProduct.mockResolvedValue(product(false));
  });

  afterEach(() => client.clear());

  it("keeps Publish pending until the refreshed inventory confirms the published state", async () => {
    let finishPublish!: (value: unknown) => void;
    mockPublishStoreProduct.mockImplementation(() => new Promise((resolve) => { finishPublish = resolve; }));
    mockListMyStoreProducts.mockResolvedValueOnce([product(false)]).mockResolvedValueOnce([product(true)]);

    render(createElement(SellerProductsScreen, { navigation: { navigate: jest.fn() } as never }), { wrapper });
    const publishButton = await screen.findByRole("button", { name: "Publish Woven tote" });
    await fireEvent.press(publishButton);

    expect(await screen.findByText("Publishing…")).toBeTruthy();
    expect(mockListMyStoreProducts).toHaveBeenCalledTimes(1);

    finishPublish(product(true));

    await waitFor(() => expect(screen.getByText("Product published.")).toBeTruthy());
    expect(mockListMyStoreProducts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Hide Woven tote" })).toBeTruthy();
  });

  it("shows API failures without changing the displayed server state", async () => {
    mockPublishStoreProduct.mockRejectedValue(new Error("Seller permission required"));
    render(createElement(SellerProductsScreen, { navigation: { navigate: jest.fn() } as never }), { wrapper });

    await fireEvent.press(await screen.findByRole("button", { name: "Publish Woven tote" }));

    await waitFor(() => expect(screen.getByText("Seller permission required")).toBeTruthy());
    expect(mockListMyStoreProducts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Publish Woven tote" })).toBeTruthy();
    expect(screen.queryByText("Product published.")).toBeNull();
  });

  it("does not report success when the server refresh does not confirm the requested state", async () => {
    mockListMyStoreProducts.mockResolvedValueOnce([product(false)]).mockResolvedValueOnce([product(false)]);
    render(createElement(SellerProductsScreen, { navigation: { navigate: jest.fn() } as never }), { wrapper });

    await fireEvent.press(await screen.findByRole("button", { name: "Publish Woven tote" }));

    await waitFor(() => expect(screen.getByText("The server hasn't confirmed the new status. Pull to refresh before trying again.")).toBeTruthy());
    expect(mockListMyStoreProducts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Publish Woven tote" })).toBeTruthy();
    expect(screen.queryByText("Product published.")).toBeNull();
  });
});
