/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useCallback, useId, type ReactNode } from "react";

import { trapTabKey } from "./dialogFocus.util";
import { DialogCloseGlyph, DialogErrorGlyph, DialogIntentIcon, dialogIntentTone, type DialogIntent, type DialogTone } from "./dialogIntent";
import { useAnimatedNativeDialog } from "./dialogLifecycle.hook";
import styles from "./dialog.module.css";
import { useSheetDragToClose } from "./sheetDrag.hook";

export type DialogLayout = "centered" | "sheet" | "sidePanel";
export type DialogSize = "small" | "medium" | "large";
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
  readonly description?: ReactNode;
  readonly intent?: DialogIntent;
  readonly icon?: ReactNode;
  /** Suppress the intent glyph when a product-specific brand mark is supplied as the icon. */
  readonly hideIntentIcon?: boolean;
  /** Render a supplied brand mark without the default circular intent badge. */
  readonly plainIcon?: boolean;
  readonly tone?: DialogTone;
  readonly layout?: DialogLayout;
  readonly size?: DialogSize;
  readonly width?: number;
  readonly dismissible?: boolean;
  readonly showCloseButton?: boolean;
  readonly closeLabel?: string;
  readonly role?: "dialog" | "alertdialog";
  readonly actions?: readonly DialogAction[];
  readonly footer?: ReactNode;
  readonly errorMessage?: string | null;
  readonly busy?: boolean;
  readonly children?: ReactNode;
}

export function resolveDialogTone(tone: DialogTone | undefined, intent: DialogIntent | undefined): DialogTone {
  return tone ?? (intent ? dialogIntentTone(intent) : "neutral");
}

export function respondToNativeClose(isOpen: boolean, isClosing: boolean, canDismiss: boolean): "ignore" | "close" | "reopen" {
  if (!isOpen || isClosing) return "ignore";
  return canDismiss ? "close" : "reopen";
}

export function isDialogBusy(actions: readonly DialogAction[] | undefined): boolean {
  return (actions ?? []).some((action) => action.busy);
}

function joinClasses(...names: readonly (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  intent,
  icon,
  hideIntentIcon = false,
  plainIcon = false,
  tone,
  layout = "centered",
  size = "small",
  width,
  dismissible = true,
  showCloseButton,
  closeLabel = "Close",
  role = "dialog",
  actions,
  footer,
  errorMessage,
  busy = false,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, isRendered, isClosing } = useAnimatedNativeDialog(isOpen);
  const isBusy = busy || isDialogBusy(actions);
  const canDismiss = dismissible && !isBusy;
  const requestClose = useCallback(() => {
    if (canDismiss) onClose();
  }, [canDismiss, onClose]);
  const isSheet = layout === "sheet";
  const dragHandlers = useSheetDragToClose(isSheet && canDismiss, onClose, { dragging: styles.dragging, settling: styles.settling });

  if (!isRendered) return null;
  const resolvedTone = resolveDialogTone(tone, intent);
  const leadingIcon = icon ?? (!hideIntentIcon && intent ? <DialogIntentIcon intent={intent} /> : null);
  const isStacked = !!leadingIcon && size === "small" && layout !== "sidePanel";
  const wantsClose = (showCloseButton ?? true) && dismissible;
  const hasActions = (actions?.length ?? 0) > 0;
  const descriptionNode = typeof description === "string" ? <p id={descriptionId} className={styles.description}>{description}</p> : description ? <div id={descriptionId} className={styles.description}>{description}</div> : null;

  return (
    <dialog
      ref={dialogRef}
      className={joinClasses(styles.dialog, styles[layout], styles[size], isClosing && styles.closing)}
      style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={isBusy || undefined}
      data-tone={resolvedTone}
      data-intent={intent}
      data-closing={isClosing ? "true" : undefined}
      onKeyDown={(event) => trapTabKey(event, dialogRef.current)}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        const response = respondToNativeClose(isOpen, isClosing, canDismiss);
        if (response === "close") onClose();
        else if (response === "reopen" && typeof dialogRef.current?.showModal === "function") dialogRef.current.showModal();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
    >
      <div className={styles.panel} data-sheet-panel="true" data-part="panel">
        {isSheet ? (
          <div {...dragHandlers} className={styles.dragZone} aria-hidden="true">
            <span className={styles.handle} data-part="handle" />
          </div>
        ) : null}
        <header {...(isSheet ? dragHandlers : {})} data-part="header" className={joinClasses(styles.header, isStacked && styles.headerStacked, isSheet && styles.dragZone)}>
          {leadingIcon ? (
            <span className={joinClasses(styles.iconBadge, plainIcon && styles.iconPlain)} aria-hidden="true" data-part="icon" data-icon-presentation={plainIcon ? "plain" : "badge"}>
              {leadingIcon}
            </span>
          ) : null}
          <div className={styles.headingText}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {descriptionNode}
          </div>
          {wantsClose ? (
            <button type="button" className={styles.close} onClick={requestClose} disabled={isBusy} aria-label={closeLabel} data-dialog-close="true">
              <DialogCloseGlyph />
            </button>
          ) : null}
        </header>
        {children ? <div className={joinClasses(styles.body, isStacked && styles.bodyStacked)}>{children}</div> : null}
        {errorMessage ? (
          <p className={styles.error} role="alert" data-part="error">
            <DialogErrorGlyph />
            <span>{errorMessage}</span>
          </p>
        ) : null}
        {hasActions || footer ? (
          <footer className={styles.footer} data-part="footer">
            {footer ? <div className={styles.customFooter}>{footer}</div> : null}
            {actions?.slice(0, 3).map((action) => {
              const variant = action.variant ?? "secondary";
              const inactive = !!action.disabled || !!action.busy || (isBusy && !action.busy);
              return (
                <button
                  key={action.label}
                  type="button"
                  className={joinClasses(styles.action, styles[`action_${variant}`], action.busy && styles.actionBusy)}
                  disabled={inactive}
                  aria-busy={action.busy || undefined}
                  aria-disabled={inactive || undefined}
                  onClick={action.onClick}
                  data-variant={variant}
                  data-autofocus={action.isInitialFocus ? "true" : undefined}
                >
                  <span className={styles.actionLabel}>{action.label}</span>
                  {action.busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
