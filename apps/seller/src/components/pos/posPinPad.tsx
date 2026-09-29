"use client";

import { useEffect } from "react";

import styles from "./posPinPad.module.css";

const pinPadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;
export const maximumPinLength = 6;

export function PosPinPad({ pin, onPinChange, onSubmit, isDisabled, listenToKeyboard = true }: { readonly pin: string; readonly onPinChange: (pin: string) => void; readonly onSubmit: () => void; readonly isDisabled?: boolean; readonly listenToKeyboard?: boolean }) {
  useEffect(() => {
    if (!listenToKeyboard || isDisabled) return;
    function handlePinKeyboardInput(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        if (pin.length < maximumPinLength) onPinChange(`${pin}${event.key}`);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        onPinChange(pin.slice(0, -1));
      } else if (event.key === "Enter" && pin.length >= 4) {
        event.preventDefault();
        onSubmit();
      }
    }
    window.addEventListener("keydown", handlePinKeyboardInput);
    return () => window.removeEventListener("keydown", handlePinKeyboardInput);
  }, [pin, onPinChange, onSubmit, isDisabled, listenToKeyboard]);

  return (
    <div className={styles.pinPad}>
      <div className={styles.dots} role="img" aria-label={`${pin.length} of up to ${maximumPinLength} digits entered`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, index) => (
          <span key={index} className={index < pin.length ? styles.filledDot : styles.dot} />
        ))}
      </div>
      <div className={styles.keys}>
        {pinPadKeys.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            disabled={isDisabled}
            aria-label={key === "back" ? "Delete last digit" : key === "clear" ? "Clear PIN" : key}
            onClick={() => {
              if (key === "back") onPinChange(pin.slice(0, -1));
              else if (key === "clear") onPinChange("");
              else if (pin.length < maximumPinLength) onPinChange(`${pin}${key}`);
            }}
          >
            {key === "back" ? "⌫" : key === "clear" ? "C" : key}
          </button>
        ))}
      </div>
      <button type="button" className={styles.submit} disabled={isDisabled || pin.length < 4} onClick={onSubmit}>
        Unlock
      </button>
    </div>
  );
}
