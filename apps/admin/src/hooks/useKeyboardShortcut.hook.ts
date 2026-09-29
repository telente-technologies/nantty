"use client";

import { useEffect, useRef } from "react";

export function isTypingInEditableField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function useKeyboardShortcut(key: string, onPress: (event: KeyboardEvent) => void, options: { readonly isEnabled?: boolean; readonly allowInFields?: boolean } = {}): void {
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  });
  const isEnabled = options.isEnabled ?? true;
  const allowInFields = options.allowInFields ?? false;
  useEffect(() => {
    if (!isEnabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!allowInFields && isTypingInEditableField(event.target)) return;
      if (event.key !== key) return;
      onPressRef.current(event);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, isEnabled, allowInFields]);
}
