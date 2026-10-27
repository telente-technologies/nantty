import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { NanttyIcon, type NanttyIconName } from "@/components/ui/nanttyIcon";

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "tender";
export type ButtonSize = "small" | "medium" | "large";

interface SharedButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconName?: NanttyIconName;
  readonly isBusy?: boolean;
  readonly fullWidth?: boolean;
  readonly children?: ReactNode;
}

function buildButtonClassName(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, extraClassName?: string): string {
  return [styles.button, styles[variant], styles[size], fullWidth ? styles.fullWidth : "", extraClassName ?? ""].filter(Boolean).join(" ");
}

export function Button({ variant = "secondary", size = "medium", iconName, isBusy = false, fullWidth = false, children, className, disabled, type = "button", ...buttonProps }: SharedButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buildButtonClassName(variant, size, fullWidth, className)} disabled={disabled || isBusy} aria-busy={isBusy || undefined} {...buttonProps}>
      {isBusy ? <span className={styles.spinner} aria-hidden="true" /> : iconName ? <NanttyIcon name={iconName} size={size === "small" ? 16 : 18} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", size = "medium", iconName, fullWidth = false, children, className }: SharedButtonProps & { readonly href: string; readonly className?: string }) {
  return (
    <Link href={href} className={buildButtonClassName(variant, size, fullWidth, className)}>
      {iconName ? <NanttyIcon name={iconName} size={size === "small" ? 16 : 18} /> : null}
      {children}
    </Link>
  );
}

export function IconButton({ iconName, label, size = "medium", variant = "ghost", className, type = "button", ...buttonProps }: { readonly iconName: NanttyIconName; readonly label: string; readonly size?: ButtonSize; readonly variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} aria-label={label} title={label} className={[styles.iconButton, styles[variant], styles[size], className ?? ""].join(" ")} {...buttonProps}>
      <NanttyIcon name={iconName} size={size === "small" ? 16 : size === "large" ? 22 : 18} />
    </button>
  );
}
