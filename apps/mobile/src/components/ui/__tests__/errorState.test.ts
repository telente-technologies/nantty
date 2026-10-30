import { createElement, type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ErrorBoundary } from "@/components/ui/errorBoundary";
import { ErrorState } from "@/components/ui/errorState";
import { EmptyState } from "@/components/ui/emptyState";
import { describeOfflineBanner } from "@/cache/offlineIndicator";
import { useOfflineStore } from "@/store/offline.store";
import { NotFoundScreen } from "@/screens/system/notFound.screen";

jest.mock("@/store/offline.store", () => {
  const { create } = jest.requireActual("zustand");
  const useOfflineStore = create(() => ({ isOnline: true, queuedMutations: [] }));
  return { useOfflineStore, isDeviceConnectedAccordingToNetInfo: (state: { isConnected?: boolean }) => state.isConnected !== false };
});
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { refresh: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn() } }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const identity = (value: unknown) => value;
  return {
    __esModule: true,
    default: { View },
    Easing: { inOut: () => undefined, sin: undefined },
    cancelAnimation: () => undefined,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: identity,
    withRepeat: identity,
    withDelay: (_: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[0],
  };
});

beforeEach(() => useOfflineStore.setState({ isOnline: true, queuedMutations: [] }));

test("counts down from Retry-After before allowing a retry", async () => {
  jest.useFakeTimers();
  try {
    const onRetry = jest.fn();
    await render(createElement(ErrorState, { error: { status: 429, code: "RATE_LIMITED", retryAfterSeconds: 2 }, onRetry }));
    expect(screen.getByText("Try again in 0:02")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again in 0:02" }).props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByRole("button", { name: "Try again in 0:02" }));
    expect(onRetry).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    expect(screen.getByText("Try again")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Try again" })));
    expect(onRetry).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test("retries automatically when the connection comes back", async () => {
  useOfflineStore.setState({ isOnline: false });
  const onRetry = jest.fn();
  await render(createElement(ErrorState, { error: new TypeError("Network request failed"), onRetry }));
  expect(screen.getByText("You're offline")).toBeTruthy();
  await act(async () => {
    useOfflineStore.setState({ isOnline: true });
  });
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/back online/)).toBeTruthy();
});

test("shows the specific screen and the reference instead of the raw message", async () => {
  await render(createElement(ErrorState, { error: { status: 403, code: "STEP_UP_REQUIRED", requestId: "zm-abc", message: "raw" }, handlers: { stepUp: jest.fn() } }));
  expect(screen.getAllByText("Confirm it's you").length).toBeGreaterThan(0);
  expect(screen.getByText("Ref zm-abc · Code STEP_UP_REQUIRED")).toBeTruthy();
  expect(screen.queryByText("raw")).toBeNull();
});

test("keeps legacy message/detail props for generic failures", async () => {
  await render(createElement(ErrorState, { message: "Couldn't load your wallet.", onRetry: jest.fn(), compact: true }));
  expect(screen.getByText("Couldn't load your wallet.")).toBeTruthy();
  expect(screen.getByText("Try again")).toBeTruthy();
});

test("renders the not-found screen with search and shortcuts", async () => {
  await render(createElement(NotFoundScreen));
  expect(screen.getByText("This page wandered off")).toBeTruthy();
  expect(screen.getByText("404", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByLabelText("Search Nantty")).toBeTruthy();
  for (const label of ["Feed", "Clips", "Mart", "Live"]) expect(screen.getByText(label)).toBeTruthy();
});

let shouldThrow = true;
function Bomb(): ReactNode {
  if (shouldThrow) throw new Error("kaboom");
  return createElement(Text, null, "Recovered");
}

test("error boundary catches a thrown render and recovers on retry", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await render(createElement(ErrorBoundary, null, createElement(Bomb)));
    expect(screen.getByText("This screen hit a snag")).toBeTruthy();
    expect(screen.queryByText("kaboom")).toBeNull();
    shouldThrow = false;
    await act(async () => {
      fireEvent.press(screen.getByText("Try again"));
    });
    expect(screen.getByText("Recovered")).toBeTruthy();
  } finally {
    consoleError.mockRestore();
  }
});

test("empty states use presets", async () => {
  await render(createElement(EmptyState, { kind: "cart" }));
  expect(screen.getByText("Your cart is empty")).toBeTruthy();
});

test("offline banner says queued actions will send later", () => {
  expect(describeOfflineBanner(2)).toBe("You're offline. 2 actions will send when you're back online.");
  expect(describeOfflineBanner(0)).toMatch(/Check your data or Wi-Fi/);
});

test.each([320, 375, 430])("inline recovery fits a %ipx container and keeps a full touch target", async (width) => {
  const onRetry = jest.fn();
  await render(createElement(ErrorState, { kind: "serverError", variant: "inline", onRetry, retryLabel: "Retry loading this part of your account" }));
  await act(async () => {
    fireEvent(screen.getByTestId("error-state-serverError"), "layout", { nativeEvent: { layout: { width, height: 240, x: 0, y: 0 } } });
  });
  expect(StyleSheet.flatten(screen.getByTestId("error-state-serverError").props.style)).toMatchObject({ flexDirection: "column", minWidth: 0 });
  const retry = screen.getByRole("button", { name: "Retry loading this part of your account" });
  expect(StyleSheet.flatten(retry.props.style)).toMatchObject({ minWidth: 0, width: "100%", maxWidth: "100%", minHeight: 44 });
  await act(async () => fireEvent.press(retry));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("does not retry an offline request until the connection probe succeeds", async () => {
  useOfflineStore.setState({ isOnline: false });
  const onRetry = jest.fn();
  jest.mocked(NetInfo.refresh).mockResolvedValueOnce({ isConnected: false } as Awaited<ReturnType<typeof NetInfo.refresh>>);
  await render(createElement(ErrorState, { kind: "offline", onRetry }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Check again" })));
  expect(onRetry).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Check again" })));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("page recovery keeps a screen-reader heading and growing text at narrow width", async () => {
  await render(createElement(ErrorState, { kind: "notFound" }));
  await act(async () => {
    fireEvent(screen.getByTestId("error-state-notFound"), "layout", { nativeEvent: { layout: { width: 320, height: 700, x: 0, y: 0 } } });
  });
  expect(screen.getByRole("header")).toBeTruthy();
  expect(screen.getByText("This page wandered off").props.allowFontScaling).toBe(true);
  expect(screen.getByText("404", { includeHiddenElements: true }).props.allowFontScaling).toBe(false);
  expect(StyleSheet.flatten(screen.getByText("This page wandered off").props.style).fontSize).toBe(28);
});
