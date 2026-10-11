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
  readonly maxScrollOffset?: number;
}

export function scrollOffsetRevealingInput(geometry: RevealGeometry): number | null {
  const { inputTop, inputHeight, viewportTop, viewportBottom, scrollOffset, bottomGap, maxScrollOffset = Number.POSITIVE_INFINITY } = geometry;
  const fitsInViewport = inputHeight + bottomGap <= viewportBottom - viewportTop;
  if (!fitsInViewport) return null;
  const overflowBelow = inputTop + inputHeight + bottomGap - viewportBottom;
  const target = overflowBelow > 0 ? scrollOffset + overflowBelow : inputTop < viewportTop ? scrollOffset - (viewportTop - inputTop) - bottomGap : null;
  if (target === null) return null;
  const clamped = Math.min(Math.max(target, 0), Math.max(maxScrollOffset, 0));
  return Math.abs(clamped - scrollOffset) < 1 ? null : clamped;
}

type HostInstance = NonNullable<ReturnType<ScrollView["getNativeScrollRef"]>>;
export interface ScrollableHandle {
  getNativeScrollRef(): unknown;
  scrollTo?(options: { y: number; animated: boolean }): void;
  scrollToOffset?(options: { offset: number; animated: boolean }): void;
}

function asHostInstance(node: unknown): HostInstance | null {
  return node && typeof (node as HostInstance).measureInWindow === "function" ? (node as HostInstance) : null;
}

function scrollToY(scroll: ScrollableHandle, y: number) {
  if (scroll.scrollToOffset) scroll.scrollToOffset({ offset: y, animated: true });
  else scroll.scrollTo?.({ y, animated: true });
}

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
  const scrollRef = useRef<ScrollableHandle | null>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const contentHeight = useRef(0);

  const revealFocusedInput = useCallback(async () => {
    const scroll = scrollRef.current;
    const input = TextInput.State.currentlyFocusedInput();
    if (!enabled || !scroll || !input) return;
    const scrollHost = asHostInstance(scroll.getNativeScrollRef());
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
      maxScrollOffset: contentHeight.current - viewport.height,
    });
    if (next !== null) scrollToY(scroll, next);
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

  const revealWhileKeyboardIsOpen = () => {
    if (enabled && Keyboard.isVisible()) requestAnimationFrame(() => void revealFocusedInput());
  };

  const scrollProps = {
    ref: (instance: ScrollableHandle | null) => {
      scrollRef.current = instance;
    },
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
      contentHeight.current = event.nativeEvent.contentSize.height;
      onScroll?.(event);
    },
    onLayout: (event: LayoutChangeEvent) => {
      onLayout?.(event);
      revealWhileKeyboardIsOpen();
    },
    onContentSizeChange: (_width: number, height: number) => {
      contentHeight.current = height;
      revealWhileKeyboardIsOpen();
    },
  };
  return { scrollRef, scrollProps, revealFocusedInput };
}
