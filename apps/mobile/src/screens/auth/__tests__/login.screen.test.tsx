import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { LoginScreen } from "@/screens/auth/login.screen";
import { authService } from "@/services/auth/auth.service";

jest.mock("@/components/auth/authStep", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    AuthStep: ({ children, actionTitle, onAction, title }: { children: ReactNode; actionTitle: string; onAction: () => void; title?: string }) =>
      React.createElement(View, null,
        title ? React.createElement(Text, null, title) : null,
        children,
        React.createElement(Pressable, { accessibilityRole: "button", onPress: onAction }, React.createElement(Text, null, actionTitle)),
      ),
  };
});

jest.mock("@/services/auth/auth.service", () => ({ authService: { logInWithEmailOrUsername: jest.fn() } }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: (select: (state: { saveSignedInSession: jest.Mock }) => unknown) => select({ saveSignedInSession: jest.fn() }) }));

test("login identifies the supported email-or-username identifier and submits the exact entered value", async () => {
  jest.mocked(authService.logInWithEmailOrUsername).mockResolvedValue({} as never);
  await render(<LoginScreen navigation={{} as never} route={{} as never} />);

  const identifier = screen.getByLabelText("Email or username");
  expect(identifier.props.keyboardType).toBe("default");
  await fireEvent.changeText(identifier, "  ari_dev  ");
  await fireEvent.changeText(screen.getByLabelText("Password"), "example-password");
  await fireEvent.press(screen.getByRole("button", { name: "Log in" }));

  await waitFor(() => expect(authService.logInWithEmailOrUsername).toHaveBeenCalledWith("ari_dev", "example-password"));
});
