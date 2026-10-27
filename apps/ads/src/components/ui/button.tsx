import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { NanttyIcon, type NanttyIconName } from "@/components/ui/nanttyIcon";

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "small" | "medium";

interface SharedButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconName?: NanttyIconName;
  readonly trailingIconName?: NanttyIconName;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function buildButtonClassName(variant: ButtonVariant = "secondary", size: ButtonSize = "medium", extraClassName?: string, iconOnly = false): string {
  return [styles.button, styles[variant], styles[size], iconOnly ? styles.iconOnly : "", extraClassName ?? ""].filter(Boolean).join(" ");
}

interface ButtonProps extends SharedButtonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {
  readonly isLoading?: boolean;
}

export function Button({ variant, size, iconName, trailingIconName, children, className, isLoading = false, disabled, type = "button", ...buttonAttributes }: ButtonProps) {
  const iconSize = size === "small" ? 14 : 16;
  return (
    <button type={type} className={buildButtonClassName(variant, size, className, !children)} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...buttonAttributes}>
      {isLoading ? <span className={styles.spinner} aria-hidden /> : iconName ? <NanttyIcon name={iconName} size={iconSize} /> : null}
      {children}
      {trailingIconName ? <NanttyIcon name={trailingIconName} size={iconSize} /> : null}
    </button>
  );
}

interface ButtonLinkProps extends SharedButtonProps {
  readonly href: string;
  readonly ariaLabel?: string;
}

export function ButtonLink({ href, variant, size, iconName, trailingIconName, children, className, ariaLabel }: ButtonLinkProps) {
  const iconSize = size === "small" ? 14 : 16;
  return (
    <Link href={href} className={buildButtonClassName(variant, size, className, !children)} aria-label={ariaLabel}>
      {iconName ? <NanttyIcon name={iconName} size={iconSize} /> : null}
      {children}
      {trailingIconName ? <NanttyIcon name={trailingIconName} size={iconSize} /> : null}
    </Link>
  );
}
