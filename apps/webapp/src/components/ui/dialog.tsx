"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "./button";
import styles from "./dialog.module.css";
import sheetStyles from "./dialogSheet.module.css";
import { CloseIcon } from "./icons";
import { useSheetDragToClose } from "./sheetDrag.hook";

export type DialogTone = "neutral" | "brand" | "danger" | "success" | "caution";
export type DialogLayout = "centered" | "sheet";
export type DialogActionVariant = "primary" | "secondary" | "danger";

export interface DialogAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: DialogActionVariant;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly isInitialFocus?: boolean;
}

export interface DialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly tone?: DialogTone;
  readonly layout?: DialogLayout;
  readonly size?: "small" | "medium" | "large";
  readonly dismissible?: boolean;
  readonly showCloseButton?: boolean;
  readonly role?: "dialog" | "alertdialog";
  readonly actions?: readonly DialogAction[];
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
}

const exitAnimationMilliseconds = 180;
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openDialogCount = 0;

function lockPageScroll(): () => void {
  openDialogCount += 1;
  const root = document.documentElement;
  if (openDialogCount === 1) {
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;
  }
  return () => {
    openDialogCount = Math.max(0, openDialogCount - 1);
    if (openDialogCount === 0) {
      root.style.overflow = "";
      root.style.paddingRight = "";
    }
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function listFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("inert") && element.offsetParent !== null);
}

function useAnimatedNativeDialog(isOpen: boolean) {
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
      dialogRef.current?.close();
      setIsRendered(false);
      setIsClosing(false);
      restoreFocusRef.current?.focus?.();
    }, prefersReducedMotion() ? 0 : exitAnimationMilliseconds);
    return () => window.clearTimeout(timer);
  }, [isOpen, isRendered]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isRendered || !isOpen || dialog.open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? listFocusableElements(dialog).find((element) => !element.dataset.dialogClose) ?? dialog;
    preferred.focus();
  }, [isRendered, isOpen]);

  useEffect(() => {
    if (!isRendered) return;
    return lockPageScroll();
  }, [isRendered]);

  return { dialogRef, isRendered, isClosing };
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  icon,
  tone = "neutral",
  layout = "centered",
  size = "small",
  dismissible = true,
  showCloseButton = layout === "sheet",
  role = "dialog",
  actions,
  footer,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, isRendered, isClosing } = useAnimatedNativeDialog(isOpen);

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);
  const dragHandlers = useSheetDragToClose(layout === "sheet" && dismissible, onClose, { dragging: sheetStyles.dragging, settling: sheetStyles.settling });
  const dragZoneProps = layout === "sheet" ? { ...dragHandlers, className: sheetStyles.dragZone } : {};

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = listFocusableElements(dialogRef.current);
    if (focusable.length === 0) return event.preventDefault();
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isRendered) return null;
  const classes = [styles.dialog, layout === "sheet" ? sheetStyles.sheet : "", styles[size], isClosing ? styles.closing : ""].filter(Boolean).join(" ");
  const hasActions = (actions?.length ?? 0) > 0;
  return (
    <dialog
      ref={dialogRef}
      className={classes}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-tone={tone}
      data-closing={isClosing ? "true" : undefined}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
    >
      <div className={styles.panel} data-sheet-panel="true" data-part="panel">
        {layout === "sheet" ? (
          <div {...dragZoneProps} aria-hidden="true">
            <span className={styles.handle} data-part="handle" />
          </div>
        ) : null}
        <header {...dragHandlers} data-part="header" className={[styles.header, icon ? styles.headerWithIcon : "", layout === "sheet" ? sheetStyles.dragZone : ""].join(" ")}>
          {icon ? <span className={styles.iconBadge} aria-hidden="true">{icon}</span> : null}
          <div className={styles.headingText}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          {showCloseButton && dismissible ? (
            <button type="button" className={styles.close} onClick={requestClose} aria-label="Close" data-dialog-close="true">
              <CloseIcon size={18} />
            </button>
          ) : null}
        </header>
        {children ? <div className={styles.body}>{children}</div> : null}
        {hasActions || footer ? (
          <footer className={styles.footer} data-part="footer">
            {footer ? <div className={styles.customFooter} data-part="customFooter">{footer}</div> : null}
            {actions?.slice(0, 3).map((action) => (
              <Button key={action.label} variant={action.variant ?? "secondary"} busy={action.busy} disabled={action.disabled} onClick={action.onClick} className={styles.action} data-part="action" data-autofocus={action.isInitialFocus ? "true" : undefined}>
                {action.label}
              </Button>
            ))}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
