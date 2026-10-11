import type { ComponentType, ReactNode } from "react";
import { Platform, TurboModuleRegistry, type ScrollView, type ScrollViewProps } from "react-native";
import type { Ref } from "react";

import {
  FallbackKeyboardProvider,
  useFallbackKeyboardAnimation,
  useFallbackKeyboardHandler,
  type KeyboardAnimationValues,
  type KeyboardMotionHandlers,
} from "./keyboardControllerFallback";

export type { KeyboardAnimationValues, KeyboardMotionEvent, KeyboardMotionHandlers } from "./keyboardControllerFallback";

export const KEYBOARD_CONTROLLER_NATIVE_MODULE = "KeyboardController";

export function hasKeyboardControllerNativeModule(platform: string = Platform.OS): boolean {
  if (platform === "web") return false;
  try {
    return TurboModuleRegistry.get(KEYBOARD_CONTROLLER_NATIVE_MODULE) != null;
  } catch {
    return false;
  }
}

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  readonly bottomOffset?: number;
  readonly extraKeyboardSpace?: number;
  readonly disableScrollOnKeyboardHide?: boolean;
  readonly enabled?: boolean;
  readonly ref?: Ref<ScrollView>;
}

export interface KeyboardProviderProps {
  readonly children: ReactNode;
  readonly statusBarTranslucent?: boolean;
  readonly navigationBarTranslucent?: boolean;
  readonly preserveEdgeToEdge?: boolean;
}

export interface KeyboardImplementation {
  readonly native: boolean;
  readonly KeyboardProvider: ComponentType<KeyboardProviderProps>;
  readonly KeyboardAwareScrollView: ComponentType<KeyboardAwareScrollViewProps> | null;
  readonly useKeyboardAnimation: () => KeyboardAnimationValues;
  readonly useKeyboardHandler: (handlers: KeyboardMotionHandlers, dependencies?: unknown[]) => void;
}

type KeyboardControllerLibrary = typeof import("react-native-keyboard-controller");

export function resolveKeyboardImplementation(nativeModulePresent: boolean, loadLibrary: () => KeyboardControllerLibrary): KeyboardImplementation {
  if (!nativeModulePresent) {
    return {
      native: false,
      KeyboardProvider: FallbackKeyboardProvider,
      KeyboardAwareScrollView: null,
      useKeyboardAnimation: useFallbackKeyboardAnimation,
      useKeyboardHandler: useFallbackKeyboardHandler,
    };
  }
  const library = loadLibrary();
  return {
    native: true,
    KeyboardProvider: library.KeyboardProvider as ComponentType<KeyboardProviderProps>,
    KeyboardAwareScrollView: library.KeyboardAwareScrollView as unknown as ComponentType<KeyboardAwareScrollViewProps>,
    useKeyboardAnimation: library.useReanimatedKeyboardAnimation,
    useKeyboardHandler: library.useKeyboardHandler as KeyboardImplementation["useKeyboardHandler"],
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadKeyboardControllerLibrary = (): KeyboardControllerLibrary => require("react-native-keyboard-controller");

export const keyboardImplementation = resolveKeyboardImplementation(hasKeyboardControllerNativeModule(), loadKeyboardControllerLibrary);

export const keyboardControllerIsNative = keyboardImplementation.native;
export const KeyboardProvider = keyboardImplementation.KeyboardProvider;
export const useKeyboardAnimation = keyboardImplementation.useKeyboardAnimation;
export const useKeyboardHandler = keyboardImplementation.useKeyboardHandler;
