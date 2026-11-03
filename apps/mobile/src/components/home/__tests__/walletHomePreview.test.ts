import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { WalletHomePreview } from "@/components/home/walletHomePreview";
import { walletsService } from "@/services/money/wallets.service";
import type { WalletSummary } from "@/types";

const mockAuth = { current: { status: "signedIn" as string, user: { id: "user-a" } } };
const mockColors = { primarySolid: "#234", onPrimary: "#fff", text: "#111", surface: "#fff", divider: "#ddd", textMuted: "#666", disabled: "#ccc", disabledText: "#666", chip: "#eee", error: "#900" };

jest.mock("@/store/auth.store", () => ({
  useAuthStore: Object.assign((selector: (state: typeof mockAuth.current) => unknown) => selector(mockAuth.current), { getState: () => mockAuth.current }),
}));
jest.mock("@/services/money/wallets.service", () => ({ walletsService: { fetchMyWalletBalance: jest.fn() } }));
jest.mock("@/theme", () => ({ makeThemedStyles: (factory: (colors: typeof mockColors) => unknown) => () => factory(mockColors) }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, props, children) }));
jest.mock("@/components/ui/button", () => ({ Button: ({ title, onPress, loading }: { title: string; onPress?: () => void; loading?: boolean }) => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, onPress }, createElement(Text, null, loading ? "Loading" : title));
} }));

const walletSummary: WalletSummary = {
  available: { amountMinor: 125_500, currency: "NGN" },
  pending: { amountMinor: 42_000, currency: "NGN" },
  inEscrow: { amountMinor: 42_000, currency: "NGN" },
  coins: { spendable: 12, earned: 20 },
};

let queryClient: QueryClient;
const renderPreview = async (onPressWallet = jest.fn()) => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { onPressWallet, ...await render(createElement(WalletHomePreview, { onPressWallet }), { wrapper }) };
};

beforeEach(() => {
  mockAuth.current = { status: "signedIn", user: { id: "user-a" } };
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  jest.clearAllMocks();
});

test("does not render or request wallet data for a signed-out visitor", async () => {
  mockAuth.current = { status: "signedOut", user: null };
  await renderPreview();
  expect(screen.queryByText("Wallet")).toBeNull();
  expect(walletsService.fetchMyWalletBalance).not.toHaveBeenCalled();
});

test("shows a loading state until the wallet summary arrives", async () => {
  let resolveWallet!: (value: WalletSummary) => void;
  jest.mocked(walletsService.fetchMyWalletBalance).mockReturnValue(new Promise((resolve) => { resolveWallet = resolve; }));
  await renderPreview();
  expect(screen.getByTestId("wallet-preview-loading")).toBeTruthy();
  await act(async () => resolveWallet(walletSummary));
  await waitFor(() => expect(screen.getByText("Available")).toBeTruthy());
});

test("loads only the signed-in account summary and offers a read-only Wallet destination", async () => {
  jest.mocked(walletsService.fetchMyWalletBalance).mockResolvedValue(walletSummary);
  const { onPressWallet } = await renderPreview();

  await waitFor(() => expect(screen.getByText("Available")).toBeTruthy());
  expect(queryClient.getQueryCache().findAll().map(({ queryKey }) => queryKey)).toContainEqual(["wallet", "balance", "home-preview", "user-a"]);
  expect(screen.getByText("In escrow")).toBeTruthy();
  expect(screen.getByText("12 coins")).toBeTruthy();
  expect(screen.queryByText("Withdraw")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "View wallet" }));
  expect(onPressWallet).toHaveBeenCalledTimes(1);
});

test("does not display cached data from a previous account after switching accounts", async () => {
  queryClient.setQueryData(["wallet", "balance", "home-preview", "user-a"], walletSummary);
  mockAuth.current = { status: "signedIn", user: { id: "user-b" } };
  jest.mocked(walletsService.fetchMyWalletBalance).mockResolvedValue({
    available: { amountMinor: 900, currency: "NGN" },
    pending: { amountMinor: 0, currency: "NGN" },
    coins: { spendable: 3, earned: 3 },
  });
  await renderPreview();

  expect(screen.getByTestId("wallet-preview-loading")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("3 coins")).toBeTruthy());
  expect(screen.queryByText("12 coins")).toBeNull();
  expect(queryClient.getQueryCache().findAll().map(({ queryKey }) => queryKey)).toContainEqual(["wallet", "balance", "home-preview", "user-b"]);
});

test("shows an error with a working retry action", async () => {
  jest.mocked(walletsService.fetchMyWalletBalance).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(walletSummary);
  await renderPreview();
  await waitFor(() => expect(screen.getByText("Wallet summary could not be loaded.")).toBeTruthy(), { timeout: 5_000 });
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Retry" })));
  await waitFor(() => expect(screen.getByText("Available")).toBeTruthy());
  expect(walletsService.fetchMyWalletBalance).toHaveBeenCalledTimes(3);
});
