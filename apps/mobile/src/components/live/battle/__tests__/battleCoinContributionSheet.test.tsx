import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockContributeBattleCoins = jest.fn();

jest.mock("@/services/live/liveGuests.service", () => ({ liveGuestsService: { contributeBattleCoins: (...args: unknown[]) => mockContributeBattleCoins(...args) } }));
jest.mock("@/components/coins/coinBalanceChip", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { CoinBalanceChip: () => React.createElement(Text, null, "Coin balance") };
});
jest.mock("@/components/coins/buyCoinsSheet", () => ({ BuyCoinsSheet: () => null }));
jest.mock("@/components/ui/avatar", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { View } = jest.requireActual("react-native") as typeof import("react-native");
  return { Avatar: () => React.createElement(View) };
});
jest.mock("@/components/ui/bottomSheet", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text, View } = jest.requireActual("react-native") as typeof import("react-native");
  return { BottomSheet: ({ title, children, visible }: { title: string; children: React.ReactNode; visible: boolean }) => visible ? React.createElement(View, null, React.createElement(Text, null, title), children) : null };
});
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Pressable, Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Button: ({ title, disabled, loading, onPress }: { title: string; disabled?: boolean; loading?: boolean; onPress: () => void }) => React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { disabled, busy: loading }, disabled: disabled || loading, onPress }, React.createElement(Text, null, title)) };
});
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Text: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(Text, props, children) };
});
jest.mock("@/theme", () => {
  const colors = { error: "red", textMuted: "gray", divider: "gray", textSubtle: "gray", primary: "blue", text: "black" };
  return { useTheme: () => ({ colors }), makeThemedStyles: (factory: (theme: { error: string; textMuted: string; divider: string; textSubtle: string; primary: string; text: string }) => unknown) => () => factory(colors) };
});

import { BattleCoinContributionSheet } from "../battleCoinContributionSheet";
import type { LiveBattle, LiveStage, LiveStageStreamer } from "@/types/liveStage.type";

const battle = { id: "battle-1", state: "active" } as LiveBattle;
const recipient = { user: { id: "viewer-2", name: "Ayo", avatarUrl: null } } as LiveStageStreamer;
const refreshedStage = { liveId: "live-1", activeBattle: battle } as LiveStage;

describe("BattleCoinContributionSheet", () => {
  const onStageUpdated = jest.fn();
  const onClose = jest.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });

  beforeEach(() => {
    mockContributeBattleCoins.mockReset();
    onStageUpdated.mockReset();
    onClose.mockReset();
    queryClient.clear();
  });

  afterEach(async () => {
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("accepts a coin amount, submits it for the selected battle participant, and applies the refreshed stage", async () => {
    mockContributeBattleCoins.mockResolvedValue(refreshedStage);
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <BattleCoinContributionSheet battle={battle} recipient={recipient} onStageUpdated={onStageUpdated} onClose={onClose} />
      </QueryClientProvider>,
    );

    expect(view.getByText("Contribute coins")).toBeTruthy();
    expect(view.getByText("Your coin contribution adds to this participant's battle score.")).toBeTruthy();
    expect(view.queryByText(/gift|artwork/i)).toBeNull();
    const amountInput = view.getByLabelText("Coin contribution amount");
    await fireEvent.changeText(amountInput, "125");
    const submit = view.getByLabelText("Contribute 125 coins");
    expect(submit.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(submit);

    await waitFor(() => expect(mockContributeBattleCoins).toHaveBeenCalledWith("battle-1", { recipientUserId: "viewer-2", coins: 125 }, expect.any(String)));
    await waitFor(() => expect(onStageUpdated).toHaveBeenCalledWith(refreshedStage));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not submit a blank or non-positive amount", async () => {
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <BattleCoinContributionSheet battle={battle} recipient={recipient} onStageUpdated={onStageUpdated} onClose={onClose} />
      </QueryClientProvider>,
    );

    expect(view.getByLabelText("Enter coin amount").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(view.getByLabelText("Coin contribution amount"), "0");
    expect(view.getByLabelText("Enter coin amount").props.accessibilityState.disabled).toBe(true);
    expect(mockContributeBattleCoins).not.toHaveBeenCalled();
  });

  it("reuses the same idempotency key after an uncertain request failure", async () => {
    mockContributeBattleCoins.mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(refreshedStage);
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <BattleCoinContributionSheet battle={battle} recipient={recipient} onStageUpdated={onStageUpdated} onClose={onClose} />
      </QueryClientProvider>,
    );
    await fireEvent.changeText(view.getByLabelText("Coin contribution amount"), "125");
    const submit = view.getByLabelText("Contribute 125 coins");

    await fireEvent.press(submit);
    await waitFor(() => expect(view.getByText("Network timeout")).toBeTruthy());
    await fireEvent.press(submit);

    await waitFor(() => expect(mockContributeBattleCoins).toHaveBeenCalledTimes(2));
    const firstKey = mockContributeBattleCoins.mock.calls[0][2];
    expect(firstKey).toEqual(expect.any(String));
    expect(mockContributeBattleCoins.mock.calls[1][2]).toBe(firstKey);
    await waitFor(() => expect(onStageUpdated).toHaveBeenCalledWith(refreshedStage));
  });
});
