import { useEffect, useRef, type ReactNode } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

export interface KeyboardMotionEvent {
  readonly height: number;
  readonly progress: number;
  readonly duration: number;
  readonly target: number;
}

export interface KeyboardMotionHandlers {
  readonly onStart?: (event: KeyboardMotionEvent) => void;
  readonly onMove?: (event: KeyboardMotionEvent) => void;
  readonly onInteractive?: (event: KeyboardMotionEvent) => void;
  readonly onEnd?: (event: KeyboardMotionEvent) => void;
}

export interface KeyboardAnimationValues {
  readonly height: SharedValue<number>;
  readonly progress: SharedValue<number>;
}

const DEFAULT_DURATION_MS = 250;
const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

function describeKeyboardEvent(event: KeyboardEvent | undefined, visible: boolean): KeyboardMotionEvent {
  const height = visible ? (event?.endCoordinates.height ?? 0) : 0;
  return { height, progress: visible ? 1 : 0, duration: event?.duration || DEFAULT_DURATION_MS, target: -1 };
}

function subscribeToKeyboardMotion(onChange: (event: KeyboardMotionEvent) => void): () => void {
  const subscriptions = [
    Keyboard.addListener(showEvent, (event) => onChange(describeKeyboardEvent(event, true))),
    Keyboard.addListener(hideEvent, (event) => onChange(describeKeyboardEvent(event, false))),
  ];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}

export function useFallbackKeyboardAnimation(): KeyboardAnimationValues {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  useEffect(
    () =>
      subscribeToKeyboardMotion((event) => {
        height.value = withTiming(-event.height, { duration: event.duration });
        progress.value = withTiming(event.progress, { duration: event.duration });
      }),
    [height, progress],
  );
  return { height, progress };
}

export function useFallbackKeyboardHandler(handlers: KeyboardMotionHandlers, dependencies: unknown[] = []): void {
  const latestHandlers = useRef(handlers);
  latestHandlers.current = handlers;
  useEffect(() => {
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribeToKeyboardMotion((event) => {
      latestHandlers.current.onStart?.(event);
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        latestHandlers.current.onEnd?.(event);
      }, event.duration);
      pendingTimers.add(timer);
    });
    return () => {
      unsubscribe();
      pendingTimers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

export function FallbackKeyboardProvider({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
