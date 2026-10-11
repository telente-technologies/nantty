"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { listFocusableElements, lockPageScroll, prefersReducedMotion, trapTabKey } from "./dialogFocus.util";

const exitAnimationMilliseconds = 180;

function focusPreferredElement(container: HTMLElement) {
  const preferred = container.querySelector<HTMLElement>("[data-autofocus]") ?? listFocusableElements(container).find((element) => !element.dataset.dialogClose) ?? container;
  preferred.focus({ preventScroll: true });
}

export function useAnimatedNativeDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      return;
    }
    if (!isRendered) return;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (dialog && typeof dialog.close === "function") dialog.close();
      else dialog?.removeAttribute("open");
      setIsRendered(false);
      setIsClosing(false);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
      restoreFocusRef.current = null;
    }, prefersReducedMotion() ? 0 : exitAnimationMilliseconds);
    return () => window.clearTimeout(timer);
  }, [isOpen, isRendered]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isRendered || !isOpen || dialog.open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    focusPreferredElement(dialog);
  }, [isRendered, isOpen]);

  useEffect(() => {
    if (!isRendered) return;
    return lockPageScroll();
  }, [isRendered]);

  useEffect(
    () => () => {
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    },
    [],
  );

  return { dialogRef, isRendered, isClosing };
}

export function useModalFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean, onEscape?: () => void) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    const container = containerRef.current;
    if (!isActive || !container) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    focusPreferredElement(container);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      trapTabKey(event, container);
    };
    document.addEventListener("keydown", handleKey);
    const releaseScroll = lockPageScroll();
    return () => {
      document.removeEventListener("keydown", handleKey);
      releaseScroll();
      restoreTo?.focus?.({ preventScroll: true });
    };
  }, [containerRef, isActive]);
}
