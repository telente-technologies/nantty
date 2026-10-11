export const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FocusableLike {
  readonly hasAttribute: (name: string) => boolean;
  readonly offsetParent: unknown;
}

export function isFocusableCandidate(element: FocusableLike): boolean {
  return !element.hasAttribute("inert") && !element.hasAttribute("hidden") && element.offsetParent !== null;
}

export function listFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(isFocusableCandidate);
}

export function nextTrappedFocus<T>(focusable: readonly T[], active: T | null, shiftKey: boolean): T | "stay" | null {
  if (focusable.length === 0) return "stay";
  const first = focusable[0] as T;
  const last = focusable[focusable.length - 1] as T;
  const isInside = active !== null && focusable.includes(active);
  if (shiftKey && (active === first || !isInside)) return last;
  if (!shiftKey && (active === last || !isInside)) return first;
  return null;
}

export function trapTabKey(event: { key: string; shiftKey: boolean; preventDefault: () => void }, container: HTMLElement | null): void {
  if (event.key !== "Tab" || !container) return;
  const target = nextTrappedFocus(listFocusableElements(container), document.activeElement as HTMLElement | null, event.shiftKey);
  if (target === null) return;
  event.preventDefault();
  if (target !== "stay") target.focus();
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let lockedDialogCount = 0;

export function lockPageScroll(): () => void {
  lockedDialogCount += 1;
  const root = document.documentElement;
  if (lockedDialogCount === 1) {
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockedDialogCount = Math.max(0, lockedDialogCount - 1);
    if (lockedDialogCount === 0) {
      root.style.overflow = "";
      root.style.paddingRight = "";
    }
  };
}
