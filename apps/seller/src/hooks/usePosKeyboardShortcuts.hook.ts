"use client";

import { useEffect, useRef } from "react";

export interface PosShortcutHandlers {
  readonly focusSearch: () => void;
  readonly openCustomer: () => void;
  readonly parkSale: () => void;
  readonly openPayment: () => void;
  readonly increaseSelectedQuantity: () => void;
  readonly decreaseSelectedQuantity: () => void;
  readonly removeSelectedLine: () => void;
  readonly showShortcuts: () => void;
  readonly selectPreviousLine: () => void;
  readonly selectNextLine: () => void;
}

const minimumGapBeforeSingleKeyShortcutInMilliseconds = 80;

function isTypingInEditableField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function usePosKeyboardShortcuts(handlers: PosShortcutHandlers, isEnabled: boolean) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) return;
    function runShortcutForKey(event: KeyboardEvent) {
      const now = performance.now();
      const millisecondsSincePreviousKey = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;
      if (document.querySelector("dialog[open]")) return;
      const currentHandlers = handlersRef.current;
      const functionKeyActions: Record<string, () => void> = { F2: currentHandlers.focusSearch, F4: currentHandlers.openCustomer, F8: currentHandlers.parkSale, F9: currentHandlers.openPayment };
      const functionKeyAction = functionKeyActions[event.key];
      if (functionKeyAction) {
        event.preventDefault();
        functionKeyAction();
        return;
      }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        currentHandlers.openPayment();
        return;
      }
      if (isTypingInEditableField(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const isDeliberateSingleKey = millisecondsSincePreviousKey > minimumGapBeforeSingleKeyShortcutInMilliseconds;
      const singleKeyActions: Record<string, () => void> = {
        "/": currentHandlers.focusSearch,
        "?": currentHandlers.showShortcuts,
        "+": currentHandlers.increaseSelectedQuantity,
        "=": currentHandlers.increaseSelectedQuantity,
        "-": currentHandlers.decreaseSelectedQuantity,
        Delete: currentHandlers.removeSelectedLine,
        ArrowUp: currentHandlers.selectPreviousLine,
        ArrowDown: currentHandlers.selectNextLine,
      };
      const singleKeyAction = singleKeyActions[event.key];
      if (singleKeyAction && isDeliberateSingleKey) {
        event.preventDefault();
        singleKeyAction();
      }
    }
    window.addEventListener("keydown", runShortcutForKey);
    return () => window.removeEventListener("keydown", runShortcutForKey);
  }, [isEnabled]);
}
