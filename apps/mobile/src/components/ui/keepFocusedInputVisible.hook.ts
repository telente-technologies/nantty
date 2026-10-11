import { useCallback, useEffect, useRef } from "react";
import { Keyboard, TextInput, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";

export const FOCUSED_INPUT_BOTTOM_GAP = 24;

export interface RevealGeometry {
  readonly inputTop: number;
  readonly inputHeight: number;
  readonly viewportTop: number;
  readonly viewportBottom: number;
  readonly scrollOffset: number;
  readonly bottomGap: number;
}

export function scrollOffsetRevealingInput({ inputTop, inputHeight, viewportTop, viewportBottom, scrollOffset, bottomGap }: RevealGeometry): number | null {
  const overflowBelow = inputTop + inputHeight + bottomGap - viewportBottom;
  if (overflowBelow > 0) {
    const roomAbove = inputTop - viewportTop;
    return scrollOffset + Math.min(overflowBelow, Math.max(roomAbove, 0));
  }
  if (inputTop < viewportTop) return Math.max(scrollOffset - (viewportTop - inputTop) - bottomGap, 0);
  return null;
}

type HostInstance = NonNullable<ReturnType<ScrollView["getNativeScrollRef"]>>;
type Measured = { readonly top: number; readonly height: number };

function measureInWindow(node: HostInstance | null): Promise<Measured | null> {
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => node.measureInWindow((_x, y, _w, height) => resolve({ top: y, height })));
}

function isDescendantOf(input: HostInstance, ancestor: HostInstance): Promise<boolean> {
  return new Promise((resolve) => input.measureLayout(ancestor, () => resolve(true), () => resolve(false)));
}

export interface KeepFocusedInputVisibleOptions {
  readonly bottomGap?: number;
  readonly enabled?: boolean;
  readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

export function useKeepFocusedInputVisible({ bottomGap = FOCUSED_INPUT_BOTTOM_GAP, enabled = true, onScroll, onLayout }: KeepFocusedInputVisibleOptions = {}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  const revealFocusedInput = useCallback(async () => {
    const scroll = scrollRef.current;
    const input = TextInput.State.currentlyFocusedInput();
    if (!enabled || !scroll || !input) return;
    const scrollHost = scroll.getNativeScrollRef();
    if (!scrollHost || !(await isDescendantOf(input, scrollHost))) return;
    const [inputBox, viewport] = await Promise.all([measureInWindow(input), measureInWindow(scrollHost)]);
    if (!inputBox || !viewport) return;
    const viewportBottom = Math.min(viewport.top + viewport.height, keyboardTop.current ?? Number.POSITIVE_INFINITY);
    const next = scrollOffsetRevealingInput({
      inputTop: inputBox.top,
      inputHeight: inputBox.height,
      viewportTop: viewport.top,
      viewportBottom,
      scrollOffset: scrollOffset.current,
      bottomGap,
    });
    if (next !== null) scroll.scrollTo({ y: next, animated: true });
  }, [bottomGap, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      requestAnimationFrame(() => void revealFocusedInput());
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [enabled, revealFocusedInput]);

  const scrollProps = {
    ref: scrollRef,
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    onLayout: (event: LayoutChangeEvent) => {
      onLayout?.(event);
      if (Keyboard.isVisible()) requestAnimationFrame(() => void revealFocusedInput());
    },
  };
  return { scrollRef, scrollProps, revealFocusedInput };
}
