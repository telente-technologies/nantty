import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

const mockFetchMyOrdersPage = jest.fn();

jest.mock("@/services/commerce/orders.service", () => ({ ordersService: { fetchMyOrdersPage: (...args: unknown[]) => mockFetchMyOrdersPage(...args) } }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { primary: "blue", textMuted: "gray", textSubtle: "gray", surface: "white" } }),
  makeThemedStyles: (factory: (colors: object) => object) => () => factory({ surface: "white" }),
}));
jest.mock("@/components/order/orderListItem", () => ({ OrderListItem: ({ order }: { order: { id: string } }) => jest.requireActual("react").createElement(jest.requireActual("react-native").Text, null, order.id) }));
jest.mock("@/components/reviews/ratePurchaseCard", () => ({ RatePurchaseLink: () => null }));
jest.mock("@/components/ui/chip", () => ({ Chip: () => null }));
jest.mock("@/components/ui/header", () => ({ Header: () => null }));
jest.mock("@/components/ui/screen", () => ({ Screen: ({ children }: { children: ReactNode }) => jest.requireActual("react").createElement(jest.requireActual("react-native").View, null, children) }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => jest.requireActual("react").createElement(jest.requireActual("react-native").Text, null, children) }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: () => null }));
jest.mock("@/components/ui/listSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/ui/brandLoader", () => ({ BrandLoader: () => null }));

import { OrdersScreen } from "./orders.screen";

const order = (id: string) => ({
  id,
  status: "paid",
  store: { name: "Sample Store" },
  reference: `ref-${id}`,
  createdAt: "2026-11-01T12:00:00Z",
}) as never;

describe("OrdersScreen cursor pagination", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    mockFetchMyOrdersPage.mockImplementation(async (_status: null, cursor: string | null) =>
      cursor === null
        ? { data: [order("order-page-1")], nextCursor: "opaque-cursor+/=" }
        : { data: [order("order-page-2")], nextCursor: null },
    );
  });

  afterEach(() => client.clear());

  it("fetches and displays later buyer-order pages when the list reaches its end", async () => {
    render(createElement(OrdersScreen, { navigation: { navigate: jest.fn() } as never }), { wrapper });

    await waitFor(() => expect(screen.getByText("order-page-1")).toBeTruthy());
    await fireEvent(screen.getByTestId("buyer-orders-list"), "onEndReached");

    await waitFor(() => expect(screen.getByText("order-page-2")).toBeTruthy());
    expect(mockFetchMyOrdersPage).toHaveBeenNthCalledWith(1, null, null);
    expect(mockFetchMyOrdersPage).toHaveBeenNthCalledWith(2, null, "opaque-cursor+/=");
  });
});
