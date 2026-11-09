import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

const mockListStoreReturns = jest.fn();
const mockApproveStoreReturn = jest.fn();
const mockDeclineStoreReturn = jest.fn();
const mockReceiveStoreReturn = jest.fn();
const mockListMyStoreLocations = jest.fn();

jest.mock("@/services/sellers/sellerReturns.service", () => ({
  sellerReturnsService: {
    listStoreReturns: (...args: unknown[]) => mockListStoreReturns(...args),
    approveStoreReturn: (...args: unknown[]) => mockApproveStoreReturn(...args),
    declineStoreReturn: (...args: unknown[]) => mockDeclineStoreReturn(...args),
    receiveStoreReturn: (...args: unknown[]) => mockReceiveStoreReturn(...args),
  },
}));
jest.mock("@/services/sellers/seller.service", () => ({ sellerService: { listMyStoreLocations: (...args: unknown[]) => mockListMyStoreLocations(...args) } }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { primary: "#176b55", text: "#111", textMuted: "#666", textSubtle: "#888", surface: "#fff", divider: "#ddd", error: "#b00020", primaryTint: "#e5f3ef", onPrimary: "#fff" } }),
  makeThemedStyles: (factory: (colors: object) => object) => () => factory({ primary: "#176b55", text: "#111", textMuted: "#666", textSubtle: "#888", surface: "#fff", divider: "#ddd", error: "#b00020", primaryTint: "#e5f3ef", onPrimary: "#fff" }),
}));
jest.mock("@/components/ui/button", () => ({ Button: ({ title, onPress, disabled, loading }: { title: string; onPress?: () => void; disabled?: boolean; loading?: boolean }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: title, disabled: disabled || loading, onPress }, jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, title)) }));
jest.mock("@/components/ui/chip", () => ({ Chip: ({ label, onPress, selected }: { label: string; onPress?: () => void; selected?: boolean }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { selected }, onPress }, jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, label)) }));
jest.mock("@/components/ui/bottomSheet", () => ({ BottomSheet: ({ visible, title, children }: { visible: boolean; title: string; children: ReactNode }) => visible ? jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").View, null, jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, title), children) : null }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children, ...props }: { children?: ReactNode }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, props as never, children) }));
jest.mock("@/components/ui/input", () => ({ TextField: (props: { label?: string; accessibilityLabel?: string; value?: string; onChangeText?: (value: string) => void }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").TextInput, { accessibilityLabel: props.accessibilityLabel ?? props.label, value: props.value, onChangeText: props.onChangeText }) }));
jest.mock("@/components/ui/emptyState", () => ({ EmptyState: ({ title, body }: { title: string; body?: string }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").View, null, jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, title), body ? jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, body) : null) }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: ({ message }: { message: string }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, message) }));
jest.mock("@/components/ui/listSkeleton", () => ({ ListSkeleton: () => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, "Loading list") }));
jest.mock("@/components/ui/brandLoader", () => ({ BrandLoader: () => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, null, "Loading more") }));

import { SellerReturnsSection } from "../sellerReturnsSection";

const returnRow = (id: string, status: "requested" | "approved" | "declined" | "refunded") => ({
  id,
  orderId: `order-${id}`,
  orderNumber: `N-${id}`,
  buyerName: "Ada Buyer",
  lines: [{ orderLineId: `line-${id}`, name: "Linen shirt", quantity: 1 }],
  reason: "Item arrived damaged",
  status,
  declineNote: status === "declined" ? "Outside the return window" : null,
  refundAmount: { amountMinor: 450000, currency: "NGN" },
  createdAt: "2026-11-01T12:00:00Z",
});

describe("seller return requests within Seller Orders", () => {
  let client: QueryClient;
  let unmount: (() => void) | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    mockListStoreReturns.mockImplementation(async ({ cursor, status }: { cursor: string | null; status: string | null }) => {
      if (status === "approved") return { data: [returnRow("approved-1", "approved")], nextCursor: null };
      if (status === "declined") return { data: [returnRow("declined-1", "declined")], nextCursor: null };
      if (status === "refunded") return { data: [returnRow("refunded-1", "refunded")], nextCursor: null };
      if (cursor === null) return { data: [returnRow("requested-1", "requested")], nextCursor: "cursor-2" };
      return { data: [returnRow("declined-2", "declined")], nextCursor: null };
    });
    mockApproveStoreReturn.mockResolvedValue(returnRow("requested-1", "approved"));
    mockDeclineStoreReturn.mockResolvedValue(returnRow("requested-1", "declined"));
    mockReceiveStoreReturn.mockResolvedValue(returnRow("approved-1", "refunded"));
    mockListMyStoreLocations.mockResolvedValue([{ id: "loc-1", name: "Main shop", active: true, isDefault: true }]);
  });

  afterEach(async () => {
    unmount?.();
    unmount = undefined;
    await client.cancelQueries();
    client.clear();
  });

  it("shows only backend-supported actions for each returned status", async () => {
    const rendered = render(createElement(SellerReturnsSection), { wrapper });
    unmount = rendered.unmount;

    await waitFor(() => expect(mockListStoreReturns).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Order N-requested-1")).toBeTruthy());
    expect(screen.getByLabelText("Approve")).toBeTruthy();
    expect(screen.getByLabelText("Decline")).toBeTruthy();
    expect(screen.queryByLabelText("Receive returned items")).toBeNull();
  });

  it("loads further cursor pages and refreshes the currently selected result set", async () => {
    const rendered = render(createElement(SellerReturnsSection), { wrapper });
    unmount = rendered.unmount;

    await waitFor(() => expect(screen.getByText("Order N-requested-1")).toBeTruthy());
    await act(async () => fireEvent(screen.getByTestId("seller-returns-list"), "onEndReached"));
    await waitFor(() => expect(screen.getByText("Order N-declined-2")).toBeTruthy());
    expect(mockListStoreReturns).toHaveBeenNthCalledWith(1, { cursor: null, status: null, limit: 25 });
    expect(mockListStoreReturns).toHaveBeenNthCalledWith(2, { cursor: "cursor-2", status: null, limit: 25 });

    mockListStoreReturns.mockClear();
    await act(async () => fireEvent(screen.getByTestId("seller-returns-list"), "refresh"));
    await waitFor(() => expect(mockListStoreReturns).toHaveBeenCalled());
    expect(mockListStoreReturns).toHaveBeenCalledWith({ cursor: null, status: null, limit: 25 });
  });

  it("applies exact backend status filters instead of filtering inferred client-side state", async () => {
    ({ unmount } = render(createElement(SellerReturnsSection), { wrapper }));
    await waitFor(() => expect(screen.getByText("Order N-requested-1")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Approved"));
    await waitFor(() => expect(screen.getByText("Order N-approved-1")).toBeTruthy());
    expect(mockListStoreReturns).toHaveBeenLastCalledWith({ cursor: null, status: "approved", limit: 25 });
    expect(screen.getByLabelText("Receive returned items")).toBeTruthy();
    expect(screen.queryByLabelText("Approve")).toBeNull();

    fireEvent.press(screen.getByLabelText("Declined"));
    await waitFor(() => expect(screen.getByText("Order N-declined-1")).toBeTruthy());
    expect(screen.queryByLabelText("Approve")).toBeNull();
    expect(screen.queryByLabelText("Receive returned items")).toBeNull();
    expect(screen.getByLabelText("Decline note: Outside the return window")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Refunded"));
    await waitFor(() => expect(screen.getByText("Order N-refunded-1")).toBeTruthy());
    expect(screen.queryByLabelText("Approve")).toBeNull();
    expect(screen.queryByLabelText("Decline")).toBeNull();
    expect(screen.queryByLabelText("Receive returned items")).toBeNull();
  });
});
