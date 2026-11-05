import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform, type ViewInstance } from "react-native";

const FOCUS_DELAY_MS = 350;

export function useAccessibilityFocusOnOpen(visible: boolean) {
  const ref = useRef<ViewInstance>(null);
  useEffect(() => {
    if (!visible || Platform.OS === "web") return;
    const timer = setTimeout(() => {
      if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  return ref;
}
