import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { Dialog } from "@/components/ui/dialog";
import { DialogHost } from "@/components/ui/dialogHost";
import { modalIntents, modalIntentTone } from "@/components/ui/modalIntent";
import { showDialog, useDialogStore } from "@/store/dialog.store";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

jest.setTimeout(30_000);

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const chain: Record<string, unknown> = {};
  chain.duration = () => chain;
  chain.easing = () => chain;
  return {
    __esModule: true,
    default: { View },
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    withSpring: (value: number) => value,
    SlideInDown: chain,
    FadeInDown: chain,
    FadeOut: chain,
    useReducedMotion: () => true,
  };
});
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (callback: () => void) => callback() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockModalRequests: { onRequestClose?: () => void } = {};
jest.mock("@/components/ui/frameAwareModal", () => ({
  FrameAwareModal: ({ visible, onRequestClose, children }: { visible: boolean; onRequestClose: () => void; children: unknown }) => {
    mockModalRequests.onRequestClose = onRequestClose;
    return visible ? children : null;
  },
}));

jest.mock("@/components/ui/accessibilityFocus.hook", () => ({ useAccessibilityFocusOnOpen: () => ({ current: null }) }));

const backButton = () => mockModalRequests.onRequestClose as () => void;

afterEach(async () => {
  await act(async () => useDialogStore.setState({ queue: [] }));
});

describe("Dialog", () => {
  test("is modal for screen readers and shows the intent icon, title and close button", async () => {
    await render(createElement(Dialog, { visible: true, onClose: jest.fn(), title: "Delete post?", message: "This can't be undone.", intent: "delete" }));
    expect(screen.getByRole("header", { name: "Delete post?" })).toBeTruthy();
    expect(screen.getByText("This can't be undone.")).toBeTruthy();
    expect(screen.getByLabelText("Close")).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"accessibilityViewIsModal":true');
  });

  test("Android back closes a dismissible dialog but not a blocking one", async () => {
    const onClose = jest.fn();
    const first = await render(createElement(Dialog, { visible: true, onClose, title: "Info" }));
    await act(async () => backButton()());
    expect(onClose).toHaveBeenCalledTimes(1);
    await first.unmount();
    await render(createElement(Dialog, { visible: true, onClose, title: "Info", dismissible: false }));
    expect(screen.queryByLabelText("Close")).toBeNull();
    await act(async () => backButton()());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a loading action disables the dialog and blocks dismissal", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    await render(createElement(Dialog, { visible: true, onClose, title: "Withdraw?", intent: "stepUp", actions: [{ label: "Withdraw", style: "primary", loading: true, onPress: onConfirm }, { label: "Cancel", style: "secondary", onPress: onClose }] }));
    expect(screen.getByLabelText("Withdraw").props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(screen.getByLabelText("Withdraw"));
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => backButton()());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Close")).toBeNull();
  });
});

describe("DialogHost", () => {
  test("destructive alerts render a destructive confirm and run it once", async () => {
    const onDelete = jest.fn();
    await render(createElement(DialogHost));
    await act(async () => showAlertWithButtons("Delete post?", "This can't be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onDelete }], { intent: "delete" }));
    await fireEvent.press(screen.getByLabelText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Delete post?")).toBeNull();
  });

  test("async actions show loading, ignore double taps and keep errors inline", async () => {
    let fail: (error: Error) => void = () => undefined;
    const onConfirm = jest.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    await render(createElement(DialogHost));
    await act(async () => showDialog({ title: "Remove account?", intent: "delete", actions: [{ label: "Remove", style: "destructive", onPress: onConfirm }, { label: "Cancel", style: "secondary" }] }));
    await fireEvent.press(screen.getByLabelText("Remove"));
    await fireEvent.press(screen.getByLabelText("Remove"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Remove").props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByLabelText("Cancel").props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => fail(new Error("No connection")));
    expect(screen.getByText("Remove account?")).toBeTruthy();
    expect(screen.getByText("No connection")).toBeTruthy();
    expect(screen.getByLabelText("Remove").props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  });

  test("a resolved async action closes the dialog", async () => {
    await render(createElement(DialogHost));
    await act(async () => showDialog({ title: "Log out?", intent: "signOut", actions: [{ label: "Log out", style: "primary", onPress: () => Promise.resolve() }] }));
    await fireEvent.press(screen.getByLabelText("Log out"));
    expect(screen.queryByText("Log out?")).toBeNull();
  });
});

test("destructive intents carry the destructive tone", () => {
  for (const intent of ["delete", "deleteAccount", "block", "unfollow"] as const) expect(modalIntentTone(intent)).toBe("destructive");
  expect(modalIntents).toEqual(expect.arrayContaining(["share", "boost", "link", "camera", "location", "mute", "report", "signIn", "stepUp", "verify"]));
});
