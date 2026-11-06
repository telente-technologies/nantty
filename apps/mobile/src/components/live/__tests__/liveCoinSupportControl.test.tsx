import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockSetCoinSupport = jest.fn();
const mockGenerateKey = jest.fn(() => "coin-support-retry-key");

jest.mock("@/services/live/live.service", () => ({ liveService: { setCoinSupport: (...args: unknown[]) => mockSetCoinSupport(...args) } }));
jest.mock("@/services/core/apiClient.service", () => ({ generateIdempotencyKey: () => mockGenerateKey() }));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { white: "#fff", primarySolid: "#00f", error: "#f00" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ error: "#f00" }),
}));
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Text: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(Text, props, children) };
});

import { LiveCoinSupportControl } from "../liveCoinSupportControl";

describe("LiveCoinSupportControl", () => {
  const onUpdated = jest.fn();

  beforeEach(() => {
    mockSetCoinSupport.mockReset();
    mockGenerateKey.mockClear();
    onUpdated.mockReset();
  });

  afterEach(cleanup);

  it("shows the host setting and refetches the session after enabling support", async () => {
    mockSetCoinSupport.mockResolvedValue({ liveId: "live-1", giftsEnabled: true });
    const view = await render(<LiveCoinSupportControl liveId="live-1" enabled={false} onUpdated={onUpdated} />);

    expect(view.getByText("Coin Support")).toBeTruthy();
    expect(view.getByText("Donations are off")).toBeTruthy();
    const toggle = view.getByLabelText("Allow viewers to donate coins");
    await act(async () => { fireEvent(toggle, "valueChange", true); });

    await waitFor(() => expect(mockSetCoinSupport).toHaveBeenCalledWith("live-1", true, "coin-support-retry-key"));
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it("retains the idempotency key and gives retry feedback after a failed update", async () => {
    mockSetCoinSupport.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ liveId: "live-1", giftsEnabled: true });
    const view = await render(<LiveCoinSupportControl liveId="live-1" enabled={false} onUpdated={onUpdated} />);
    const toggle = view.getByLabelText("Allow viewers to donate coins");

    await act(async () => { fireEvent(toggle, "valueChange", true); });
    await waitFor(() => expect(view.getByText("Couldn't update Coin Support. Try again. Retry")).toBeTruthy());
    await act(async () => { fireEvent.press(view.getByLabelText("Retry Coin Support update")); });

    await waitFor(() => expect(mockSetCoinSupport).toHaveBeenCalledTimes(2));
    expect(mockSetCoinSupport.mock.calls[0]).toEqual(["live-1", true, "coin-support-retry-key"]);
    expect(mockSetCoinSupport.mock.calls[1]).toEqual(mockSetCoinSupport.mock.calls[0]);
    expect(mockGenerateKey).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });
});
