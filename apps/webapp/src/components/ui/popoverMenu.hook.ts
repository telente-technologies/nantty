"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

const itemSelector = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])';

export function usePopoverMenu({ closeOnTab = true }: { readonly closeOnTab?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const firstItem = menuRef.current?.querySelector<HTMLElement>(itemSelector);
    firstItem?.focus({ preventScroll: true });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const onMenuKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") {
      if (closeOnTab) setIsOpen(false);
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "ArrowDown" ? (index + 1) % items.length
      : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  }, [closeOnTab]);

  const triggerProps = {
    "aria-haspopup": "menu" as const,
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? menuId : undefined,
    onClick: () => setIsOpen((open) => !open),
  };

  const menuProps = { id: menuId, role: "menu" as const, onKeyDown: onMenuKeyDown };

  return { isOpen, close, containerRef, triggerRef, menuRef, triggerProps, menuProps };
}
