import { createElement, type ReactNode } from "react";
import { Keyboard, NativeModules, Text, TurboModuleRegistry } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { scrollOffsetRevealingInput } from "@/components/ui/keepFocusedInputVisible.hook";
import { hasKeyboardControllerNativeModule, keyboardImplementation, resolveKeyboardImplementation } from "@/components/ui/keyboardController";
import { fallbackLiftsLayoutItself, useFallbackKeyboardHandler } from "@/components/ui/keyboardControllerFallback";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { KeyboardStickyFooter, keyboardLiftDistance } from "@/components/ui/keyboardStickyFooter";

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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flattenStyle)) : ((style ?? {}) as Record<string, unknown>);

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };

function hostNodes(node: unknown): HostNode[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(hostNodes);
  const host = node as HostNode;
  return [host, ...(host.children ?? []).flatMap(hostNodes)];
}

const containsText = (node: HostNode, text: string): boolean =>
  (node.children ?? []).some((child) => (typeof child === "string" ? child === text : containsText(child, text)));

function innermostWithStyle(text: string, key: string): Record<string, unknown> | undefined {
  const matches = hostNodes(screen.toJSON()).filter((node) => containsText(node, text) && flattenStyle(node.props.style)[key] !== undefined);
  return matches.length ? flattenStyle(matches[matches.length - 1].props.style) : undefined;
}

describe("native module detection", () => {
  afterEach(() => jest.restoreAllMocks());

  test("is false in Jest, where the keyboard-controller native module is missing", () => {
    expect(hasKeyboardControllerNativeModule("ios")).toBe(false);
    expect(keyboardImplementation.native).toBe(false);
  });

  test("is false on web even when a module would resolve", () => {
    jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({} as never);
    expect(hasKeyboardControllerNativeModule("web")).toBe(false);
  });

  test("finds the module through TurboModuleRegistry or the legacy NativeModules table", () => {
    jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({} as never);
    expect(hasKeyboardControllerNativeModule("android")).toBe(true);
    jest.restoreAllMocks();
    NativeModules.KeyboardController = {};
    expect(hasKeyboardControllerNativeModule("ios")).toBe(true);
    delete NativeModules.KeyboardController;
  });

  test("never loads the library when the module is missing", () => {
    const loadLibrary = jest.fn();
    const implementation = resolveKeyboardImplementation(false, loadLibrary);
    expect(loadLibrary).not.toHaveBeenCalled();
    expect(implementation.native).toBe(false);
    expect(implementation.KeyboardAwareScrollView).toBeNull();
  });

  test("uses the library's components and hooks when the module is present", () => {
    const library = {
      KeyboardProvider: () => null,
      KeyboardAwareScrollView: () => null,
      useReanimatedKeyboardAnimation: jest.fn(),
      useKeyboardHandler: jest.fn(),
    };
    const implementation = resolveKeyboardImplementation(true, () => library as never);
    expect(implementation.native).toBe(true);
    expect(implementation.KeyboardProvider).toBe(library.KeyboardProvider);
    expect(implementation.KeyboardAwareScrollView).toBe(library.KeyboardAwareScrollView);
    expect(implementation.useKeyboardAnimation).toBe(library.useReanimatedKeyboardAnimation);
  });
});

describe("fallback path", () => {
  test("the provider just renders its children", async () => {
    await render(createElement(keyboardImplementation.KeyboardProvider, null, createElement(Text, null, "inside")));
    expect(screen.getByText("inside")).toBeTruthy();
  });

  test("Android relies on the resize layout mode instead of lifting layout a second time", () => {
    expect(fallbackLiftsLayoutItself("ios")).toBe(true);
    expect(fallbackLiftsLayoutItself("android")).toBe(false);
  });

  test("keyboard handlers get start and end events from the plain Keyboard API", async () => {
    jest.useFakeTimers();
    const listeners: Record<string, (event: unknown) => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((name: string, callback: (event: unknown) => void) => {
      listeners[name] = callback;
      return { remove: jest.fn() };
    }) as never);
    const onStart = jest.fn();
    const onEnd = jest.fn();
    function Probe() {
      useFallbackKeyboardHandler({ onStart, onEnd });
      return null;
    }
    await render(createElement(Probe));
    const showName = Object.keys(listeners).find((name) => name.endsWith("Show")) as string;
    listeners[showName]({ endCoordinates: { height: 300, screenY: 544 }, duration: 200 });
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ height: 300, progress: 1 }));
    jest.advanceTimersByTime(200);
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ height: 300, progress: 1 }));
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("KeyboardAwareForm falls back to a keyboard-avoiding scroll form and pads the footer by the bottom inset", async () => {
    await render(
      createElement(KeyboardAwareForm, { footer: createElement(Text, null, "Save") }, createElement(Text, null, "Field")),
    );
    expect(screen.getByTestId("keyboard-aware-form-fallback")).toBeTruthy();
    expect(innermostWithStyle("Save", "paddingBottom")?.paddingBottom).toBe(34);
  });

  test("KeyboardAwareForm leaves the bottom inset alone when the screen already handles it", async () => {
    await render(
      createElement(KeyboardAwareForm, { safeAreaHandledByParent: true, footer: createElement(Text, null, "Save") }, createElement(Text, null, "Field")),
    );
    expect(innermostWithStyle("Save", "paddingBottom")?.paddingBottom).toBe(0);
  });
});

describe("sticky footer insets", () => {
  test("the footer rests on the safe area and lifts by the full keyboard height", () => {
    expect(keyboardLiftDistance(34, false, 0)).toEqual({ resting: 34, below: 0 });
  });

  test("a parent that pads the safe area or a tab bar shortens the lift", () => {
    expect(keyboardLiftDistance(34, true, 0)).toEqual({ resting: 0, below: 34 });
    expect(keyboardLiftDistance(34, false, 83)).toEqual({ resting: 34, below: 83 });
  });

  test("renders its children above a spacer that holds the bottom inset at rest", async () => {
    await render(createElement(KeyboardStickyFooter, null, createElement(Text, null, "Send")));
    expect(screen.getByText("Send")).toBeTruthy();
    const heights = hostNodes(screen.toJSON()).map((node) => flattenStyle(node.props.style).height);
    expect(heights).toContain(34);
  });
});

describe("revealing the focused input", () => {
  const base = { viewportTop: 100, viewportBottom: 500, scrollOffset: 0, bottomGap: 24, maxScrollOffset: 1000 };

  test("scrolls a covered input until it sits 24pt above the keyboard", () => {
    expect(scrollOffsetRevealingInput({ ...base, inputTop: 480, inputHeight: 42 })).toBe(46);
  });

  test("leaves a visible input alone", () => {
    expect(scrollOffsetRevealingInput({ ...base, inputTop: 200, inputHeight: 42 })).toBeNull();
  });

  test("brings an input above the viewport back down into view", () => {
    expect(scrollOffsetRevealingInput({ ...base, scrollOffset: 300, inputTop: 40, inputHeight: 42 })).toBe(216);
  });

  test("never scrolls past the end of the content, so a composer that fits is not pushed up", () => {
    expect(scrollOffsetRevealingInput({ ...base, inputTop: 480, inputHeight: 42, maxScrollOffset: 0 })).toBeNull();
    expect(scrollOffsetRevealingInput({ ...base, inputTop: 480, inputHeight: 42, maxScrollOffset: 10 })).toBe(10);
  });

  test("leaves an input taller than the viewport to the text view's own caret scrolling", () => {
    expect(scrollOffsetRevealingInput({ ...base, inputTop: 120, inputHeight: 600 })).toBeNull();
  });
});
