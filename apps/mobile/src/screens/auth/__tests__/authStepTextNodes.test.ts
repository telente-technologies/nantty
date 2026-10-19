import { createElement } from "react";
import { act, render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";

import { AuthStep } from "@/components/auth/authStep";
import { OnboardingScreen } from "@/screens/auth/onboarding.screen";
import { SignUpContactScreen } from "@/screens/auth/signUpContact.screen";

jest.setTimeout(30_000);

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    useReducedMotion: () => false,
  };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));
jest.mock("@/services/auth/appleSignIn.service", () => ({ checkIfAppleSignInIsAvailableOnThisDevice: () => Promise.resolve(true) }));
jest.mock("@/services/auth/auth.service", () => ({ authService: { signInWithSocialProvider: jest.fn(), sendOneTimeCode: jest.fn() } }));

const hostComponentsThatAcceptText = new Set(["Text", "TextInput"]);

function collectRawTextOutsideText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null, parentType: string, found: string[]) {
  if (node === null) return found;
  if (typeof node === "string") {
    if (!hostComponentsThatAcceptText.has(parentType)) found.push(`${JSON.stringify(node)} inside <${parentType}>`);
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectRawTextOutsideText(child, parentType, found));
    return found;
  }
  (node.children ?? []).forEach((child) => collectRawTextOutsideText(child, node.type, found));
  return found;
}

const rawTextOutsideTextInRenderedScreen = () => collectRawTextOutsideText(screen.toJSON(), "root", []);

const navigation = { navigate: jest.fn(), setParams: jest.fn(), getParent: () => ({ goBack: jest.fn() }), goBack: jest.fn(), canGoBack: () => true };

describe("auth screens never render a raw text node inside a View (React Native Web rejects them)", () => {
  it("SignUpContact", async () => {
    await render(createElement(SignUpContactScreen as never, { navigation, route: { key: "SignUpContact", name: "SignUpContact" } }));
    await act(async () => undefined);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(rawTextOutsideTextInRenderedScreen()).toEqual([]);
  });

  it("AuthStep with a heading, right slot and footer", async () => {
    await render(
      createElement(AuthStep, { title: "Title", subtitle: "Subtitle", actionTitle: "Next", onAction: jest.fn(), right: null, footer: null }, createElement("View")),
    );
    expect(rawTextOutsideTextInRenderedScreen()).toEqual([]);
  });

  it("Onboarding in sign-up and log-in modes", async () => {
    for (const mode of ["signup", "login"] as const) {
      await render(createElement(OnboardingScreen as never, { navigation, route: { key: "Onboarding", name: "Onboarding", params: { mode } } }));
      await act(async () => undefined);
      expect(rawTextOutsideTextInRenderedScreen()).toEqual([]);
      await screen.unmount();
    }
  });

  it("detects the stray whitespace that the old SignUpContact markup produced", () => {
    const tree = { type: "View", props: {}, children: [{ type: "TextInput", props: {}, children: null }, "      ", { type: "View", props: {}, children: null }] } as ReactTestRendererJSON;
    expect(collectRawTextOutsideText(tree, "root", [])).toEqual(['"      " inside <View>']);
  });
});
