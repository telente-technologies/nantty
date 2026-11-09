import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { OnboardingScreen } from "@/screens/auth/onboarding.screen";
import { useGuestSessionStore } from "@/store/guestSession.store";

jest.setTimeout(30_000);

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
jest.mock("@/services/auth/appleSignIn.service", () => ({ checkIfAppleSignInIsAvailableOnThisDevice: () => Promise.resolve(true) }));
jest.mock("@/services/auth/auth.service", () => ({ authService: { beginSocialSignIn: jest.fn(), completeSocialSignInWithBirthday: jest.fn() } }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ saveSignedInSession: jest.fn() }) }));

import { authService } from "@/services/auth/auth.service";

const buildNavigation = () => {
  const goBack = jest.fn();
  return { navigate: jest.fn(), setParams: jest.fn(), getParent: () => ({ goBack }), goBack };
};

async function renderOnboarding(params: { mode?: "signup" | "login"; dismissible?: boolean } = {}) {
  const navigation = buildNavigation();
  await render(createElement(OnboardingScreen as never, { navigation, route: { key: "Onboarding", name: "Onboarding", params } }));
  await act(async () => undefined);
  return navigation;
}

beforeEach(() => useGuestSessionStore.setState({ isBrowsingAsGuest: false }));

test("Skip sits in the top bar and starts guest browsing", async () => {
  await renderOnboarding();
  expect(screen.queryByText("Browse first")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
  expect(useGuestSessionStore.getState().isBrowsingAsGuest).toBe(true);
});

test("the email option reads Use email and opens the matching flow", async () => {
  const signUp = await renderOnboarding();
  expect(screen.queryByText("Email")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Use email" }));
  expect(signUp.navigate).toHaveBeenCalledWith("SignUpContact");
  await screen.unmount();
  const logIn = await renderOnboarding({ mode: "login" });
  await fireEvent.press(screen.getByRole("button", { name: "Use email" }));
  expect(logIn.navigate).toHaveBeenCalledWith("Login");
});

test("every sign-in option shares one height, radius, border and icon spacing", async () => {
  await renderOnboarding();
  const options = ["Continue with Apple", "Continue with Google", "Use email"].map((name) => screen.getByRole("button", { name }));
  const shapeOf = (element: (typeof options)[number]) => {
    const flat = Object.assign({}, ...[element.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
    return { height: flat.height, borderRadius: flat.borderRadius, borderWidth: flat.borderWidth };
  };
  const shapes = options.map(shapeOf);
  expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
  expect(shapes[0]).toMatchObject({ height: 44, borderWidth: 1 });
});

test("a first-time social account collects birthday and retries using the same challenge", async () => {
  jest.mocked(authService.beginSocialSignIn).mockResolvedValue({
    status: "birthday_required",
    challenge: { provider: "google", idToken: "google-token", nonce: "google-nonce" },
  });
  jest.mocked(authService.completeSocialSignInWithBirthday).mockRejectedValue(new Error("Try again."));
  await renderOnboarding();

  await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByText("Add your birthday to continue with Google")).toBeTruthy();
  const birthday = screen.getByLabelText("Birthday, day month year");
  await fireEvent.changeText(birthday, "01/01/1990");
  expect(screen.getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

  expect(authService.completeSocialSignInWithBirthday).toHaveBeenCalledWith(
    { provider: "google", idToken: "google-token", nonce: "google-nonce" },
    "1990-01-01",
  );
  expect(await screen.findByText("Try again.")).toBeTruthy();
});

test("the Not now variant takes the same top-right spot and closes the sheet without guest mode", async () => {
  const navigation = await renderOnboarding({ dismissible: true });
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  expect(useGuestSessionStore.getState().isBrowsingAsGuest).toBe(false);
});
