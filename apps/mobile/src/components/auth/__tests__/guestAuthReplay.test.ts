import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { act, render } from "@testing-library/react-native";

import { GuestAuthReplayCoordinator } from "@/components/auth/guestAuthReplay";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { useAuthStore } from "@/store/auth.store";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";
import { openAuthFlowThenReturn, requireAuthThen } from "@/utils/requireAuth.util";

jest.mock("@/navigation/navigationRef", () => ({
  rootNavigationRef: {
    isReady: jest.fn(),
    getCurrentRoute: jest.fn(),
    getRootState: jest.fn(),
    navigate: jest.fn(),
    dispatch: jest.fn(),
  },
}));
jest.mock("@/services/sellers/productInteractions.service", () => ({ refreshTrackingConsents: jest.fn() }));

const mockNavigationRef = rootNavigationRef as unknown as {
  isReady: jest.Mock;
  getCurrentRoute: jest.Mock;
  getRootState: jest.Mock;
  navigate: jest.Mock;
  dispatch: jest.Mock;
};
let mockCurrentRoute: { name: string; params?: object };

jest.mock("@/utils/secureStorage.util", () => ({
  SecureStorageUnavailableError: class extends Error {},
  secureStorage: { get: jest.fn(async () => null), set: jest.fn(async () => undefined), remove: jest.fn(async () => undefined) },
  retryWhenAppComesToForeground: jest.fn(),
  moveSessionKeychainItemsToBackgroundReadableAccessOnce: jest.fn(async () => undefined),
}));

const signedInState = { status: "signedIn" as const, user: null, accessToken: "access", refreshToken: "refresh" };

async function renderCoordinator() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return await render(createElement(GuestAuthReplayCoordinator), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  useAuthStore.setState({ status: "signedOut", user: null, accessToken: null, refreshToken: null });
  usePendingAuthIntentStore.getState().discardPendingIntent();
  usePendingAuthIntentStore.getState().closeSignInPrompt();
  mockCurrentRoute = { name: "Explore", params: { category: "for_you" } };
  mockNavigationRef.isReady.mockReturnValue(true);
  mockNavigationRef.getCurrentRoute.mockImplementation(() => mockCurrentRoute);
  mockNavigationRef.getRootState.mockReturnValue({ key: "root", index: 0, routes: [{ name: "AuthFlow" }] });
  mockNavigationRef.dispatch.mockImplementation(() => { mockCurrentRoute = { name: "Tabs" }; });
  mockNavigationRef.navigate.mockImplementation((name: string, params?: object) => { mockCurrentRoute = { name, params }; });
  mockNavigationRef.navigate.mockClear();
});

afterEach(() => jest.useRealTimers());

describe("guest protected-action auth return", () => {
  test("returns to the captured route and replays the pending action once after sign-in", async () => {
    const action = jest.fn();
    const coordinator = await renderCoordinator();
    expect(requireAuthThen(action, undefined, "follow people")).toBe(false);
    openAuthFlowThenReturn("login");
    expect(mockNavigationRef.navigate).toHaveBeenCalledWith("AuthFlow", { mode: "login" });
    expect(action).not.toHaveBeenCalled();

    await act(async () => { useAuthStore.setState(signedInState); });
    act(() => { jest.advanceTimersByTime(350); });

    expect(mockNavigationRef.navigate).toHaveBeenCalledWith("Explore", { category: "for_you" });
    expect(action).toHaveBeenCalledTimes(1);
    expect(usePendingAuthIntentStore.getState().pendingIntent).toBeNull();
    coordinator.unmount();
  });

  test("discarding the pending intent on auth cancellation prevents later replay", async () => {
    const action = jest.fn();
    const coordinator = await renderCoordinator();
    requireAuthThen(action, undefined, "follow people");
    usePendingAuthIntentStore.getState().discardPendingIntent();

    await act(async () => { useAuthStore.setState(signedInState); });
    act(() => { jest.advanceTimersByTime(350); });

    expect(action).not.toHaveBeenCalled();
    expect(mockNavigationRef.navigate).not.toHaveBeenCalledWith("Explore", { category: "for_you" });
    coordinator.unmount();
  });
});
