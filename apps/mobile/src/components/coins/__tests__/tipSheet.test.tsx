import { cleanup, render, userEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockSendTip = jest.fn();
const mockGenerateKey = jest.fn(() => "tip-test-key");

jest.mock("@/services/money/coins.service", () => ({ coinsService: { sendTip: (...args: unknown[]) => mockSendTip(...args) } }));
jest.mock("@/services/core/apiClient.service", () => ({ generateIdempotencyKey: () => mockGenerateKey() }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { chip: "#eee", textMuted: "#666", success: "#080", error: "#f00", primary: "#111", divider: "#ddd", primaryTint: "#fafafa" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ primary: "#111", divider: "#ddd", primaryTint: "#fafafa" }),
}));
jest.mock("@/components/ui/bottomSheet", () => ({
  BottomSheet: ({ children, visible }: { children: ReactNode; visible: boolean }) => {
    const { View } = jest.requireActual("react-native") as typeof import("react-native");
    return visible ? <View>{children}</View> : null;
  },
}));
jest.mock("@/components/ui/button", () => ({
  Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => {
    const { Pressable } = jest.requireActual("react-native") as typeof import("react-native");
    const { Text } = jest.requireActual("react-native") as typeof import("react-native");
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress}><Text>{title}</Text></Pressable>;
  },
}));
jest.mock("@/components/ui/input", () => ({
  TextField: ({ label, value, onChangeText, ...props }: { label: string; value: string; onChangeText: (value: string) => void }) => {
    const { TextInput } = jest.requireActual("react-native") as typeof import("react-native");
    return <TextInput {...props} accessibilityLabel={label} value={value} onChangeText={onChangeText} />;
  },
}));
jest.mock("@/components/coins/buyCoinsSheet", () => ({ BuyCoinsSheet: () => null }));
jest.mock("@/components/coins/coinBalanceChip", () => ({ CoinBalanceChip: () => null }));
jest.mock("@/components/coins/coinAmount", () => ({
  CoinAmountWithIcon: ({ label }: { label: string }) => {
    const { Text } = jest.requireActual("react-native") as typeof import("react-native");
    return <Text>{label}</Text>;
  },
}));
jest.mock("@/components/icons", () => ({
  Coin24Icon: () => null,
  Gift24Icon: () => null,
  SealCheck20Icon: () => null,
}));

import { TipSheet } from "../tipSheet";

async function renderTipSheet(targetType: "live" | "profile" = "live") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return await render(
    <QueryClientProvider client={queryClient}>
      <TipSheet target={{ targetType, targetId: "target-1", creatorName: "Host" }} onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}

describe("TipSheet live donation note", () => {
  beforeEach(() => {
    mockSendTip.mockReset().mockResolvedValue({ tipId: "tip-1", coins: 50, balance: 50 });
    mockGenerateKey.mockClear();
  });

  afterEach(cleanup);

  it("submits a trimmed optional note with live coin donations", async () => {
    const view = await renderTipSheet();
    const user = userEvent.setup();
    await user.paste(view.getByTestId("live-tip-note-field"), "  Keep up the stream!  ");
    await user.press(view.getByRole("button", { name: "Donate 50 coins" }));

    await waitFor(() => expect(mockSendTip).toHaveBeenCalledWith({ targetType: "live", targetId: "target-1", coins: 50, note: "Keep up the stream!" }, "tip-test-key"));
  });

  it("bounds the note to 280 characters", async () => {
    const view = await renderTipSheet();
    const user = userEvent.setup();
    const field = view.getByTestId("live-tip-note-field");
    expect(field.props.maxLength).toBe(280);
    await user.paste(field, "n".repeat(350));
    expect(view.getByTestId("live-tip-note-field").props.value).toHaveLength(280);
  });

  it("counts emoji as Unicode code points without splitting surrogate pairs", async () => {
    const view = await renderTipSheet();
    const user = userEvent.setup();
    const field = view.getByTestId("live-tip-note-field");
    const emoji = "🙂";
    await user.paste(field, emoji.repeat(281));
    const boundedNote = view.getByTestId("live-tip-note-field").props.value as string;

    expect(Array.from(boundedNote)).toHaveLength(280);
    expect(boundedNote).toBe(emoji.repeat(280));
  });

  it("omits an empty note and does not expose the field for profile gifting", async () => {
    const live = await renderTipSheet();
    await userEvent.setup().press(live.getByRole("button", { name: "Donate 50 coins" }));
    await waitFor(() => expect(mockSendTip).toHaveBeenCalledWith({ targetType: "live", targetId: "target-1", coins: 50 }, "tip-test-key"));
    live.unmount();

    const profile = await renderTipSheet("profile");
    expect(profile.queryByTestId("live-tip-note-field")).toBeNull();
  });
});
