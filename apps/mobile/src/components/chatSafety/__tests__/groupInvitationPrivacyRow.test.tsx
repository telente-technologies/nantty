import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { error: "#b00020" } }) }));
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Text: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(Text, props, children) };
});

import { GroupInvitationPrivacyRow } from "../groupInvitationPrivacyRow";

describe("GroupInvitationPrivacyRow", () => {
  afterEach(cleanup);

  it("renders the server value and reports the requested change without changing its own value", async () => {
    const onChange = jest.fn();
    await render(<GroupInvitationPrivacyRow enabled={false} onChange={onChange} />);
    const toggle = screen.getByLabelText("Require group invitations");

    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, "valueChange", true);

    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Require group invitations").props.value).toBe(false);
  });

  it("keeps the current server value visible and exposes a failure message", async () => {
    await render(<GroupInvitationPrivacyRow enabled={false} hasError onChange={jest.fn()} />);

    expect(screen.getByLabelText("Require group invitations").props.value).toBe(false);
    expect(screen.getByRole("alert").props.children).toContain("couldn’t update your group invitation preference");
  });

  it("disables changes while the server mutation is pending", async () => {
    await render(<GroupInvitationPrivacyRow enabled onChange={jest.fn()} disabled />);
    expect(screen.getByLabelText("Require group invitations").props.disabled).toBe(true);
  });
});
