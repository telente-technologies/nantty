import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { LiveCommentBar } from "@/components/live/liveCommentBar";
import { PillComposer } from "@/components/ui/pillComposer";

jest.setTimeout(30_000);
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: { View }, FadeIn: { duration: () => undefined }, useReducedMotion: () => true };
});

function ControlledPill({ onSend, isSending }: { onSend: (text: string) => void; isSending: boolean }) {
  const [value, setValue] = useState("");
  return createElement(PillComposer, { value, onChangeText: setValue, onSend, isSending, placeholder: "Write", inputLabel: "Message", sendLabel: "Send message" });
}

describe("PillComposer", () => {
  test("send appears only for sendable content and swaps back when cleared", async () => {
    const onSend = jest.fn();
    await render(createElement(ControlledPill, { onSend, isSending: false }));
    const input = screen.getByLabelText("Message");
    expect(screen.queryByLabelText("Send message")).toBeNull();
    await fireEvent.changeText(input, "  \n​ ");
    expect(screen.queryByLabelText("Send message")).toBeNull();
    await fireEvent.changeText(input, "👍🏽");
    await fireEvent.press(screen.getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalledWith("👍🏽");
    await fireEvent.changeText(input, "");
    expect(screen.queryByLabelText("Send message")).toBeNull();
  });

  test("send stays visible but inert while a send is in flight", async () => {
    const onSend = jest.fn();
    await render(createElement(ControlledPill, { onSend, isSending: true }));
    await fireEvent.changeText(screen.getByLabelText("Message"), "a");
    const send = screen.getByLabelText("Send message");
    expect(send.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(send);
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("LiveCommentBar", () => {
  test("reactions button swaps to send for a lone emoji and back when cleared", async () => {
    const onSend = jest.fn();
    await render(createElement(LiveCommentBar, { onSend, onToggleReactions: jest.fn() }));
    const input = screen.getByLabelText("Add comment");
    expect(screen.getByLabelText("Reactions")).toBeTruthy();
    await fireEvent.changeText(input, "🔥");
    expect(screen.queryByLabelText("Reactions")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Send comment"));
    expect(onSend).toHaveBeenCalledWith("🔥");
    expect(screen.getByLabelText("Reactions")).toBeTruthy();
  });
});
