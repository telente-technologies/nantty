"use client";

import { useEffect, useRef } from "react";

const maximumMillisecondsBetweenScannerKeys = 50;
const minimumScannedCodeLength = 4;

function isTypingInEditableField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.dataset.scanTarget === "true") return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function usePosBarcodeScanner(onCodeScanned: (code: string) => void, isEnabled: boolean) {
  const bufferRef = useRef<{ characters: string; lastKeyAt: number; isRapid: boolean }>({ characters: "", lastKeyAt: 0, isRapid: true });
  const onCodeScannedRef = useRef(onCodeScanned);
  onCodeScannedRef.current = onCodeScanned;

  useEffect(() => {
    if (!isEnabled) return;
    function collectScannerKeystrokes(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingInEditableField(event.target)) return;
      const buffer = bufferRef.current;
      const now = performance.now();
      const millisecondsSinceLastKey = now - buffer.lastKeyAt;
      if (event.key === "Enter") {
        if (buffer.characters.length >= minimumScannedCodeLength && buffer.isRapid) {
          event.preventDefault();
          onCodeScannedRef.current(buffer.characters);
        }
        bufferRef.current = { characters: "", lastKeyAt: now, isRapid: true };
        return;
      }
      if (event.key.length !== 1) return;
      if (millisecondsSinceLastKey > maximumMillisecondsBetweenScannerKeys * 3) {
        bufferRef.current = { characters: event.key, lastKeyAt: now, isRapid: true };
        return;
      }
      bufferRef.current = { characters: `${buffer.characters}${event.key}`.slice(-64), lastKeyAt: now, isRapid: buffer.isRapid && millisecondsSinceLastKey <= maximumMillisecondsBetweenScannerKeys };
    }
    window.addEventListener("keydown", collectScannerKeystrokes, true);
    return () => window.removeEventListener("keydown", collectScannerKeystrokes, true);
  }, [isEnabled]);
}

